# Statistics operations and troubleshooting

Read [the architecture reference](statistics-architecture.md) for payload and
counting invariants, [the runbook](statistics-backend.md) for application setup,
and [migration prerequisites/order](../supabase/README.md) before changing SQL.
These queries are for Supabase SQL Editor, after the inferred-uploader migration.

## Inspect deployment

```sql
select
  to_regprocedure('public.ingest_match(jsonb)') as upload_rpc,
  to_regprocedure('public.ingest_match_base(jsonb)') as private_insert,
  to_regprocedure('public.global_statistics()') as all_time_rpc,
  to_regprocedure('public.latest_upload_statistics()') as latest_rpc,
  to_regprocedure('public.opponent_statistics()') as opponents_rpc;
```

A null means the function is absent. Inspect actual definitions to establish what
is deployed; a local migration file does not prove the hosted function matches it.

```sql
select pg_get_functiondef('public.ingest_match(jsonb)'::regprocedure);
select pg_get_functiondef('public.opponent_statistics()'::regprocedure);
```

Aggregate RPCs require signed-in JWT claims. Calling them directly as SQL Editor's
database role may correctly return a sign-in error.

## Coverage and recent attribution

```sql
with complete_matches as (
  select m.* from public.matches m
  where (
    select count(*) from public.match_players p
    where p.match_identifier = m.identifier
  ) = 2
)
select
  count(*) as complete_matches,
  count(*) filter (where inferred_uploader_slot is not null) as opponents_eligible,
  count(*) filter (where inferred_uploader_slot is null) as unknown_uploader
from complete_matches;
```

```sql
select
  m.identifier,
  m.created_at as uploaded_at,
  m.recorded_utc,
  p0.player_name as player0,
  p1.player_name as player1,
  m.inferred_uploader_slot,
  case m.inferred_uploader_slot
    when 0 then p0.player_name when 1 then p1.player_name
  end as inferred_uploader,
  case m.inferred_uploader_slot
    when 0 then p1.player_name when 1 then p0.player_name
  end as counted_opponent,
  m.score_difference
from public.matches m
join public.match_players p0
  on p0.match_identifier = m.identifier and p0.player_slot = 0
join public.match_players p1
  on p1.match_identifier = m.identifier and p1.player_slot = 1
order by m.created_at desc, m.identifier desc
limit 10;
```

## Manually backfill a known uploader

Use only when the project owner has identified the uploader. This explicitly
overrides any different existing attribution for matching games. It does not
verify the submitting Google account, and it affects existing records only.
No provenance field currently distinguishes manual attribution from inference.

Replace the name in the `target` CTE. Matching ignores case and surrounding
spaces. If the name identifies both sides, the match is excluded as ambiguous.

Preview first:

```sql
with target as (
  select 'ZakMcKracken'::text as player_name
), matched as (
  select p.match_identifier, min(p.player_slot)::smallint as uploader_slot
  from public.match_players p cross join target t
  where lower(btrim(p.player_name)) = lower(btrim(t.player_name))
  group by p.match_identifier
  having count(*) = 1
)
select m.identifier, m.inferred_uploader_slot as previous_slot,
       matched.uploader_slot as new_slot
from public.matches m join matched on matched.match_identifier = m.identifier
where m.inferred_uploader_slot is distinct from matched.uploader_slot;
```

Apply the reviewed changes:

```sql
begin;

with target as (
  select 'ZakMcKracken'::text as player_name
), matched as (
  select p.match_identifier, min(p.player_slot)::smallint as uploader_slot
  from public.match_players p cross join target t
  where lower(btrim(p.player_name)) = lower(btrim(t.player_name))
  group by p.match_identifier
  having count(*) = 1
)
update public.matches m
set inferred_uploader_slot = matched.uploader_slot
from matched
where m.identifier = matched.match_identifier
  and m.inferred_uploader_slot is distinct from matched.uploader_slot
returning m.identifier, m.inferred_uploader_slot;

commit;
```

This preserves fingerprints, scores, players, and `created_at`. Refresh Opponents
only afterward; its query calculates aggregates live. It does not change
all-time/both-side results. The local cache need not be cleared. To backfill only
previously unknown attribution, replace the `is distinct from` condition in the
update with `m.inferred_uploader_slot is null`.

## Insert permissions

```sql
select
  has_function_privilege('anon', 'public.ingest_match(jsonb)', 'execute')
    as anon_can_insert,
  has_function_privilege('authenticated', 'public.ingest_match(jsonb)', 'execute')
    as signed_in_can_insert,
  has_function_privilege('authenticated', 'public.ingest_match_base(jsonb)', 'execute')
    as signed_in_can_call_private_base;
```

Expected: false, true, false. The allowed wrapper still checks the request's user
and role. An application publishable key is not a user session.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| RPC missing | Apply the named migration in the correct project; frontend deployment does not apply SQL |
| Opponents only empty while all-time has data | Inspect coverage; old, tied, or single-file uploads may all have unknown uploader slots |
| No request on repeated file selection | Confirmed identifiers are skipped by the endpoint-specific local cache |
| Retry did not correct old metadata | Duplicate inserts never update existing faction/commander/uploader data |
| Mirror matchup omitted | Filter the uploader side, not its faction ID |
| Opponent wins/margins reversed | Use retained player's result; negate the stored margin for slot 1 |
| Latest player bars seem like uploader counts | The chart counts replay players, not submitting accounts |
| Ambiguous `result` SQL error | Qualify columns and use a distinct PL/pgSQL output name; current scripts use `statistics_payload` |
| Ingestion returns 401 | Session is absent/expired; see [Google setup](authentication.md) |
| Old single-account rejection | Check the deployed Edge Function and private insert/base guards |

For cache debugging, inspect only the `sovl-uploaded-matches-v1:<endpoint URL>`
key for the active endpoint. Clearing all browser storage also clears the login
session. Clearing just the upload cache still cannot update existing database rows.

## Release verification

1. Run the [local checks](statistics-backend.md#verification-commands). HTTP/auth
   tests use mocks and do not validate hosted migration execution.
2. Apply new SQL in dependency order. Deploy Edge Function source separately if
   it changes. Do not replace newer functions with older migration definitions.
3. Sign in with a real account and submit two fresh games with a common player
   and different opponents. Verify stored slots and opponent-only results.
4. Check a tied selection and single-file upload remain unattributed.
5. Re-select confirmed games: the browser should skip requests. A duplicate from
   another browser must not create a new row or change insertion time.
6. Verify missing/expired sessions are rejected; a new signed-in account can submit.
7. Confirm all-time counts both sides, latest selects by insertion time, and
   opponent-only counts one side per attributed match. Report live observations
   separately from automated test output.
