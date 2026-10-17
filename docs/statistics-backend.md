# Shared statistics uploads

The site uses the hosted Supabase project `eovllsljleficdhpgcda` and its
`ingest-matches` Edge Function. No local database or Supabase CLI is required.
The committed publishable key is a public browser credential; database grants,
the insert function, and the Edge Function enforce authorization.

## Using the site

1. Choose **Continue with Google** on the entry screen. New accounts are created
   automatically. Configure the [Google OAuth provider](authentication.md) first.
   The parser mounts only after sign-in; signing out removes it and its loaded data.
2. Load a replay or bulk selection. All signed-in users can submit valid summaries
   automatically after the authenticated-upload backend update below is deployed.
3. Upload results and failures are logged to the developer console. Reloading
   the files retries submission; identifiers prevent duplicate storage.

Confirmed inserted/duplicate fingerprints are cached in local storage, scoped to
the endpoint. Subsequent selections skip these matches without an API request.
Repeated matches within one selection are also deduplicated. Rejected or failed
matches remain eligible for retry. Clearing site storage resets the cache;
database uniqueness remains the final duplicate check. Unavailable or full local
storage does not block uploads.

Anonymous users see only the login screen. Signed-in accounts can analyze files
and submit summaries. Bundled
sample loads do not submit statistics. Replays missing recorded match data are
skipped. The Supabase SDK manages OAuth, session persistence, and refresh.

Only the compact payload from `src/parser/statistics.ts` is sent. It includes the
fingerprint, UTC timestamp, player names, factions, commander type IDs, winner,
and score difference. It excludes files, event streams, and army lists.
Bulk selections send arrays of at most 100 matches and 1 MB per request; a single
upload sends an object. Backend failures do not block local analysis. A request
timeout can occur after the server has saved data; retrying is safe.

Optional deployment environment overrides:

```text
VITE_SUPABASE_URL=https://eovllsljleficdhpgcda.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<public publishable key>
```

Never put secret/service-role keys or passwords in Vite environment variables.

## Global statistics page

Run `supabase/migrations/20261017000000_global_statistics.sql` in Supabase SQL
Editor. It creates a read-only aggregate RPC available to signed-in users;
direct table access stays blocked. No Edge Function changes are needed.
The page is at `#/statistics`, with a navigation link next to Replay parser.
It fetches backend aggregates on entry and on Refresh. Switching pages preserves
the loaded replay. Faction filtering applies to the tables; overview counts
always describe the whole database.

Only complete two-player matches count. Both armies contribute to faction and
matchup results; mirror games contribute two appearances. Commander types are
deduplicated per army/match. Draws count as non-wins, and score differences use
the army's perspective. No player names or individual match records are returned.

## Verification commands

```text
npm run typecheck
npm run build
node scripts/test-statistics.mjs
node scripts/test-statistics-upload.mjs
node scripts/test-global-statistics.mjs
node scripts/test-ingest-auth.mjs
node scripts/test-replay-format.mjs
```

The upload test mocks all HTTP requests. Live end-to-end verification requires
the uploader to sign in, submit a real match twice, and confirm that the second
submission reports a duplicate. The Edge Function and SQL must already have been
deployed in the dashboard.

## Enable submissions from every signed-in user

1. Run `supabase/migrations/20261017010000_authenticated_uploads.sql` in SQL Editor.
   It replaces the original UUID check in `public.ingest_match(jsonb)` with a
   non-null user ID and authenticated-role check. Existing validation, atomic
   inserts, and duplicate handling remain unchanged. If the deployed function
   differs from the expected original, it fails without changing permissions.
2. Deploy `supabase/functions/ingest-matches/index.ts` and `handler.ts` to the
   existing Edge Function using the dashboard editor. Both files must be present.
   Alternatively, in the previously supplied single-file function, remove the
   `allowedUser` constant and the `if (auth.user.id !== allowedUser)` rejection
   block; keep `auth.getUser(token)` and its invalid-session rejection intact.
3. Keep the function's gateway JWT toggle as previously configured; the handler
   verifies user sessions itself. It uses the caller's Authorization header for
   the RPC, not an admin/service-role client.
4. Deploy the frontend and test a fresh account with a replay not already in the
   browser cache. Confirm added/duplicate counts in the console and database.

The migration grants RPC execution only to `authenticated`. Direct browser
table access remains blocked. Missing/expired sessions are rejected by the Edge
Function, and the database also checks the caller's identity and role.
