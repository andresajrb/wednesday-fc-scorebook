import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Cliente de Supabase, o null si el build no trae la configuración de la nube: en ese
 * caso la app funciona como siempre, solo en el teléfono. En el frontend va únicamente
 * la clave pública; los permisos los pone el servidor (RLS).
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
      })
    : null;

export const cloudEnabled = supabase !== null;
