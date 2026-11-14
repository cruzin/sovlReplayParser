# Supabase deployment and migration order

This directory contains the Edge Function source and incremental database changes.
Deploying the React app does not deploy these files to Supabase. Apply SQL in the
project's SQL Editor and deploy the Edge Function separately through its editor.
No local Supabase server is required for the current workflow.

## Baseline prerequisite

The original `matches`, `match_players`, `match_commanders` tables, their RLS and
grants, and the original validated `ingest_match(jsonb)` were initially created
through SQL supplied in the setup conversation. A complete initial schema/insert
migration is **not currently checked into this repository**. The migrations below
are incremental; they are not a complete fresh-project bootstrap.

Before recreating the project, obtain a reviewed schema export and original
insert-function definition from the existing database. Do not invent a reduced
replacement that drops validation or changes duplicate/transaction semantics.
The expected schema and contracts are described in
[the architecture reference](../docs/statistics-architecture.md).

## Apply in this order

| SQL migration | Purpose / prerequisite |
| --- | --- |
| [20261017000000_global_statistics.sql](migrations/20261017000000_global_statistics.sql) | All-time aggregate RPC; requires original tables |
| [20261017010000_authenticated_uploads.sql](migrations/20261017010000_authenticated_uploads.sql) | Changes original insert's known single-UUID guard to authenticated users |
| [20261114000000_latest_upload_statistics.sql](migrations/20261114000000_latest_upload_statistics.sql) | Latest-30 RPC and upload-time index |
| [20261114010000_latest_upload_players.sql](migrations/20261114010000_latest_upload_players.sql) | Replaces latest RPC, adding player appearance counts |
| [20261114020000_inferred_uploaders.sql](migrations/20261114020000_inferred_uploaders.sql) | Adds inferred slot; renames insert to private base and creates authenticated wrapper |
| [20261114030000_opponent_statistics.sql](migrations/20261114030000_opponent_statistics.sql) | Adds opponent-only RPC; requires inferred slot |

Do not rerun an older function-replacement migration over a newer definition.
For example, rerunning the initial latest-30 migration removes the later player
counts until its replacement is applied again. The authenticated-upload patch
targets the original insert function, not the later inference wrapper.

The inference migration retains the existing validated insert as
`ingest_match_base(jsonb)`. Both names matter: keep base execution private and
browser RPC execution limited to the authenticated wrapper. The wrapper and base
use the caller's JWT claims, not an uploader email allowlist.

## Edge Function

Deploy both [index.ts](functions/ingest-matches/index.ts) and
[handler.ts](functions/ingest-matches/handler.ts) under `ingest-matches`.
The function verifies a signed-in user and uses the same Authorization header for
the database call. It accepts an object or array, capped at 100 matches and 1 MB.
The `uploader` addition needs no handler change because the match object is
forwarded intact.

The current setup has gateway JWT verification disabled and explicitly verifies
the user in the handler with `auth.getUser(token)`. Keep that handler validation;
the public API key is not a login credential. Backend keys remain backend-only.

See [database operations](../docs/statistics-operations.md) for inspection
queries and troubleshooting, and [Google setup](../docs/authentication.md) for
provider/redirect configuration. Files existing in the repo do not prove they
have been applied to the hosted project.
