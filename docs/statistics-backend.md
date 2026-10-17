# Shared statistics uploads

The site uses the hosted Supabase project `eovllsljleficdhpgcda` and its
`ingest-matches` Edge Function. No local database or Supabase CLI is required.
The committed publishable key is a public browser credential; database grants,
the insert function, and the Edge Function enforce authorization.

## Using the site

1. Sign in on the entry screen with an account created in Supabase Authentication.
   The parser mounts only after sign-in; signing out removes it and its loaded data.
2. Load a replay or bulk selection. For the authorized uploader account
   (`b424b4a7-751b-4dac-9a6b-8840c7720777`), valid summaries are sent automatically.
3. Upload results and failures are logged to the developer console. Reloading
   the files retries submission; identifiers prevent duplicate storage.

Confirmed inserted/duplicate fingerprints are cached in local storage, scoped to
the endpoint. Subsequent selections skip these matches without an API request.
Repeated matches within one selection are also deduplicated. Rejected or failed
matches remain eligible for retry. Clearing site storage resets the cache;
database uniqueness remains the final duplicate check. Unavailable or full local
storage does not block uploads.

Anonymous users see only the login screen. Other signed-in accounts can analyze
files, but backend upload permission remains restricted to the uploader. Bundled
sample loads do not submit statistics. Replays missing recorded match data are
skipped. Passwords are cleared from the form after sign-in attempts; the Supabase
SDK manages session persistence and refresh.

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
node scripts/test-replay-format.mjs
```

The upload test mocks all HTTP requests. Live end-to-end verification requires
the uploader to sign in, submit a real match twice, and confirm that the second
submission reports a duplicate. The Edge Function and SQL must already have been
deployed in the dashboard.
