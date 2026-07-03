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