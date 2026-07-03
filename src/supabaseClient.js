// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Faltam variáveis de ambiente do Supabase. Verifique o arquivo .env");
}

export const supabase = createClient(url, key);
