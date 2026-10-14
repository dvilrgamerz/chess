import { describe, expect, it } from "vitest";
import { resolveSupabaseConfig } from "../src/lib/supabaseConfig.js";

describe("Supabase production configuration", () => {
  it("rejects missing settings rather than silently using another project", () => {
    const config = resolveSupabaseConfig({});
    expect(config.isConfigured).toBe(false);
    expect(config.url).toBeNull();
    expect(config.publishableKey).toBeNull();
    expect(config.error).toMatch(/missing/);
  });

  it("rejects template placeholder values", () => {
    const config = resolveSupabaseConfig({
      VITE_SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "YOUR_PUBLISHABLE_KEY"
    });
    expect(config.isConfigured).toBe(false);
    expect(config.error).toMatch(/placeholders/);
  });

  it("accepts a real HTTPS project URL and browser-safe publishable key", () => {
    const config = resolveSupabaseConfig({
      VITE_SUPABASE_URL: "https://example-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_sample"
    });
    expect(config.isConfigured).toBe(true);
    expect(config.url).toBe("https://example-project.supabase.co");
    expect(config.publishableKey).toBe("sb_publishable_sample");
  });

  it("accepts legacy anonymous keys during migration", () => {
    const config = resolveSupabaseConfig({
      VITE_SUPABASE_URL: "https://example-project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "legacy-browser-anon-key"
    });
    expect(config.isConfigured).toBe(true);
  });

  it("blocks insecure remote HTTP endpoints but supports local development", () => {
    expect(resolveSupabaseConfig({
      VITE_SUPABASE_URL: "http://example-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sample"
    }).isConfigured).toBe(false);

    expect(resolveSupabaseConfig({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sample"
    }).isConfigured).toBe(true);
  });
});
