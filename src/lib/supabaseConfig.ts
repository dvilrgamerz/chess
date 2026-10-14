/** Reads browser-safe Supabase settings injected by Vite at build time. */
export interface SupabaseBrowserEnv {
  VITE_SUPABASE_URL?: unknown;
  VITE_SUPABASE_PUBLISHABLE_KEY?: unknown;
  VITE_SUPABASE_ANON_KEY?: unknown;
}

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function resolveSupabaseConfig(env: SupabaseBrowserEnv) {
  const url = readString(env.VITE_SUPABASE_URL);
  const publishableKey =
    readString(env.VITE_SUPABASE_PUBLISHABLE_KEY) || readString(env.VITE_SUPABASE_ANON_KEY);
  let error: string | null = null;

  if (!url || !publishableKey) {
    error = "Supabase URL or publishable key is missing from the deployment environment.";
  } else if (/YOUR_PROJECT_REF|YOUR_PUBLISHABLE_KEY|YOUR_ANON_KEY|PLACEHOLDER/i.test(url + publishableKey)) {
    error = "Supabase environment values still contain example placeholders.";
  } else {
    try {
      const parsed = new URL(url);
      const localDevelopment = parsed.protocol === "http:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
      if (parsed.protocol !== "https:" && !localDevelopment) {
        error = "Supabase must use HTTPS outside local development.";
      }
      if (parsed.username || parsed.password || !parsed.hostname) {
        error = "Supabase URL is invalid.";
      }
    } catch {
      error = "Supabase URL is invalid.";
    }
  }

  return {
    isConfigured: !error,
    error,
    url: error ? null : url,
    publishableKey: error ? null : publishableKey
  };
}
