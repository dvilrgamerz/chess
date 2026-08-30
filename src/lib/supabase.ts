import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "https://hulquvtadftsezwjthni.supabase.co";
// This is a Supabase publishable key. It is designed to be present in browser applications; never use a service_role/secret key here.
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "sb_publishable__I2Zi5gFYb4pUwG3IdMhTg_pOgHXS1j";

export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
