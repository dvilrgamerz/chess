# Chess Arena v2 — restoring Supabase on Netlify

Production URL: **https://chessv21.netlify.app/**

## Important: identify the existing database first

The earlier frontend referenced Supabase project `hulquvtadftsezwjthni` as a hardcoded fallback. **Do not assume that project still exists or is active.** First determine where existing Chess Arena users and games live. Creating a new project without migrating that data would leave prior accounts and game history behind.

The frontend now requires explicit build-time settings instead of silently connecting to that possibly outdated project.

## 1. Confirm the Supabase project

1. Open the Supabase dashboard under the account/organization that owns Chess Arena.
2. Identify the project storing its **profiles**, **games**, **online_games**, and **matchmaking_queue** tables. Check that the project is active.
3. From that project's API settings, obtain its project URL and **publishable** key. The key starts `sb_publishable_` for the modern key type.
4. Never put a Supabase secret key or service-role key in a `VITE_*` environment variable or in GitHub.

If the project is missing, restore/reconnect the original project before creating a new one, unless you intentionally want to start over.

## 2. Configure the correct Netlify site

Use the Netlify project actually serving **https://chessv21.netlify.app/**. In its environment variables, set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_BROWSER_PUBLISHABLE_KEY
```

Replace both sample values with the real values **in Netlify**, not in committed source files. Ensure these settings are available to **production builds**, then trigger a new production build/deploy. Vite embeds the public configuration into the built JavaScript; changing Netlify variables without rebuilding does not update a previously built site.

The frontend shows a clear backend-configuration error when these values are missing or invalid rather than silently connecting to a fallback project. Being configured does **not** prove that the remote service is reachable or that its database is correctly provisioned.

## 3. Review Supabase schema and Edge Functions

The repo includes:

- `supabase/schema.sql` — **upgrade SQL**, not a complete new-project bootstrap. It begins by altering existing `public.profiles`, `public.games`, and other tables. **Do not apply it directly to an empty Supabase project**; it will fail without the original base schema.
- `supabase/functions/chess-game` — handles friend rooms, matchmaking, game moves, and clocks.
- `supabase/functions/chess-admin` — handles history, profiles, admin operations, and reports.

On the correct project, inspect the existing schema and migration history before applying anything. Confirm the required tables and RLS/grants exist; deploy both Edge Functions using the authorized Supabase workflow. Keep the service-role/secret credentials server-side only.

Do not disable RLS to work around authorization errors. Review the security policies and project advisors before production use.

## 4. Update authentication redirects

In the same Supabase project, under **Authentication → URL Configuration**:

- Set the Site URL to `https://chessv21.netlify.app`.
- Add `https://chessv21.netlify.app/reset-password` as an allowed redirect URL for password recovery.
- If you use additional auth callback routes or preview URLs, allowlist only those that are actually used.

This app's password reset flow uses `/reset-password?recovery=1`; the origin must match the deployed Netlify domain.

## 5. Verify end to end

1. Verify the latest Netlify deploy is published and `https://chessv21.netlify.app` renders.
2. Open DevTools → Network. Look for failed `/auth/v1`, `/rest/v1`, and `/functions/v1` calls, and distinguish **401**, **403**, **404**, **500**, DNS, and CORS errors.
3. Test signup, email confirmation, sign-in, refresh, logout, and password reset.
4. With **two different test accounts**, create and join a friend room. Confirm turn validation and clocks and that both clients receive updates.
5. Check matchmaking, saved games, ratings, and the Supabase Realtime publication/subscriptions.
6. Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` in CI.

**Troubleshooting guide:** A 404 for `chess-game` or `chess-admin` generally means the function is not deployed at the configured project. A missing `profiles` relation suggests incomplete schema. A 401/403 requires checking authentication, permissions, and RLS rather than using a privileged browser key.

Current Supabase references:
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/database/postgres/row-level-security
