// src/AuthContext.jsx - finanças
// Provê o usuário logado para o app inteiro + funções de login/logout.
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,

    signInEmail: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),

    signUpEmail: (email, password) =>
      supabase.auth.signUp({ email, password }),

    signInGoogle: () =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      }),

    signOut: () => supabase.auth.signOut(),

    // Envia a imagem para o bucket "avatars" (Storage) na pasta do usuário
    // e devolve a URL pública. Evita guardar base64 gigante no user_metadata.
    uploadAvatar: async (blob) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;

      if (!userId) throw new Error("Usuário não autenticado.");

      const path = `${userId}/avatar.jpg`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          upsert: true,
          contentType: "image/jpeg",
          cacheControl: "3600",
        });

      if (error) throw error;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      // Cache-bust para a nova foto aparecer na hora.
      return `${data.publicUrl}?t=${Date.now()}`;
    },

    // Remove o arquivo de avatar do bucket (pasta do usuário).
    deleteAvatar: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;

      if (!userId) throw new Error("Usuário não autenticado.");

      const { error } = await supabase.storage
        .from("avatars")
        .remove([`${userId}/avatar.jpg`]);

      if (error) throw error;
    },

    updateProfile: async (metadata) => {
      const { data, error } = await supabase.auth.updateUser({
        data: metadata,
      });

      if (error) throw error;

      if (data?.user) {
        setSession((currentSession) =>
          currentSession
            ? {
              ...currentSession,
              user: data.user,
            }
            : currentSession
        );
      }

      return data;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}