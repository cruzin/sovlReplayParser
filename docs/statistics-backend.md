# Shared statistics uploads

Start with [statistics-architecture.md](statistics-architecture.md) for the payload,
fingerprint, inference examples, and counting decisions. See
[statistics-operations.md](statistics-operations.md) for read-only inspection,
manual uploader backfills, troubleshooting, and release checks. Review
[SQL prerequisites and migration order](../supabase/README.md) before deployment.

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

The `uploader` field is an inferred replay player name or `null`. For bulk
selections with at least two distinct valid games, names are counted once per
game (ignoring case and surrounding spaces). A uniquely highest count identifies
the inferred uploader. Ties and single-game uploads remain unset. Each game is
tagged only if that inferred name identifies one of its players unambiguously.
Inference uses the selection before the local-storage filter and before batching;
duplicate files cannot influence it. This is not a verified account identity.

Run `supabase/migrations/20261114020000_inferred_uploaders.sql` to store this as
`matches.inferred_uploader_slot`. The migration preserves the deployed ingest
validation behind a private base function and adds an authenticated wrapper.
The existing Edge Function forwards the field without changes. Old payloads
without `uploader` remain supported. Existing/duplicate matches are not backfilled
or overwritten, and fingerprint/local-cache keys do not change.

To select opponent sides in future statistics, join matches and players with
`m.inferred_uploader_slot is not null and p.player_slot <> m.inferred_uploader_slot`.
Exclude unknown inferences from opponent-only statistics. Current statistics
continue to count both sides; the separate Opponents only page uses this filter.
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

## Latest uploads statistics

Run `supabase/migrations/20261114000000_latest_upload_statistics.sql` in SQL
Editor to enable `#/statistics/latestUploads` (the **Latest 30 uploads** link).
This page reuses the Global Statistics layout, charts, and faction filter.
It calls a separate authenticated `latest_upload_statistics()` RPC, leaving the
existing all-time endpoint unchanged.

The query selects at most 30 complete matches ordered by `matches.created_at`
descending, with identifier as a deterministic tie-breaker, before calculating
any faction, matchup, or commander aggregates. Recorded match dates do not
determine the selection. Re-uploaded duplicates do not become new uploads.
When fewer than 30 matches exist, all available complete matches are included.
Overview counts and the pie chart use only this selection; commander copies and
mirror matches follow the same counting rules as all-time statistics.

Run `supabase/migrations/20261114010000_latest_upload_players.sql` to add the
`playerAppearances` array to that RPC. Player names are grouped ignoring case
and surrounding spaces, with one appearance per distinct match/name. The page
shows a descending bar chart for the whole latest-30 selection, independent of
the faction filter. Player names are replay display names, not verified accounts;
these counts do not identify which account submitted the match.

The **Latest 30 uploads** navigation link is shown only to
`kjell.emil.wilhelmsen@gmail.com`. This is a link-visibility rule, not a backend
access restriction: signed-in users can still open the route directly, and the
RPC keeps its existing authenticated-user permission.

## Opponent-only statistics

After the inferred-uploader migration, run
`supabase/migrations/20261114030000_opponent_statistics.sql` in SQL Editor.
`#/statistics/onlyOpponents` calls the separate `opponent_statistics()` RPC.
It returns the same statistics shape plus `excludedMatches` for complete matches
without an inferred uploader. All-time and latest-30 queries are unchanged.

Each eligible match contributes exactly one side: the opponent of the inferred
uploader. Faction popularity, wins/losses/draws, score differences, and commander
results all use that side only. Matchup rows retain the uploader's faction as
the opposing context, but the results belong to the non-uploader. Mirror matches
still count one opponent army; filtering does not exclude a whole faction ID.
Unknown uploader slots are excluded, never guessed. Old records are not backfilled.
This reduces uploader-selection bias but still describes the uploaded sample,
not an unbiased census of SOVL players.

## Verification commands

```text
npm run typecheck
npm run build
node scripts/test-statistics.mjs
node scripts/test-statistics-upload.mjs
node scripts/test-global-statistics.mjs
node scripts/test-ingest-auth.mjs
node scripts/test-uploader-inference.mjs
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
