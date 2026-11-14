-- Run in SQL Editor. Requires the existing authenticated ingest_match(jsonb).
begin;

alter table public.matches
  add column if not exists inferred_uploader_slot smallint
  check (inferred_uploader_slot in (0, 1));

comment on column public.matches.inferred_uploader_slot is
  'Nullable payload player slot inferred from batch name frequencies; not the authenticated submitter identity.';

-- Keep the deployed payload validation and atomic match insertion intact.
do $migration$
begin
  if to_regprocedure('public.ingest_match_base(jsonb)') is null then
    alter function public.ingest_match(jsonb) rename to ingest_match_base;
  end if;
end;
$migration$;

revoke all on function public.ingest_match_base(jsonb) from public, anon, authenticated, service_role;

create or replace function public.ingest_match(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_slot smallint;
  matching_names integer;
  ingest_status text;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated' then
    raise exception 'Sign in before uploading' using errcode = '42501';
  end if;

  if payload ? 'uploader' and jsonb_typeof(payload->'uploader') <> 'null' then
    if jsonb_typeof(payload->'uploader') is distinct from 'string' then
      raise exception 'Uploader must be a player name or null';
    end if;
    if jsonb_typeof(payload->'players') is distinct from 'array' then
      raise exception 'Expected a players array';
    end if;
    select count(*), min(p.ordinality - 1)::smallint
      into matching_names, inferred_slot
    from jsonb_array_elements(payload->'players') with ordinality as p(player, ordinality)
    where p.player->>'name' = payload->>'uploader';
    if matching_names <> 1 or inferred_slot not in (0, 1) then
      raise exception 'Uploader must identify exactly one match player';
    end if;
  end if;

  ingest_status := public.ingest_match_base(payload);
  if ingest_status = 'inserted' and inferred_slot is not null then
    update public.matches m set inferred_uploader_slot = inferred_slot
    where m.identifier = payload->>'identifier';
  end if;
  -- Duplicates never overwrite an earlier inference or change the fingerprint.
  return ingest_status;
end;
$$;

revoke all on function public.ingest_match(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.ingest_match(jsonb) to authenticated;

commit;
