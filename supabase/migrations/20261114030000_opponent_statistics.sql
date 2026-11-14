-- Opponent-only all-time aggregates. Requires inferred_uploader_slot migration.
begin;

create or replace function public.opponent_statistics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  statistics_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view statistics' using errcode = '42501';
  end if;

  with all_complete_matches as (
    select m.* from public.matches m
    where (select count(*) from public.match_players p
           where p.match_identifier = m.identifier) = 2
  ), complete_matches as (
    select m.* from all_complete_matches m
    where m.inferred_uploader_slot is not null
  ), players as (
    select p.*, case when p.player_slot = 0 then m.score_difference
                    else -m.score_difference::bigint end as margin
    from public.match_players p
    join complete_matches m on m.identifier = p.match_identifier and p.player_slot <> m.inferred_uploader_slot
  ), factions as (
    select p.faction_id,
      count(*) as games,
      count(*) filter (where p.result = 'win') as wins,
      count(*) filter (where p.result = 'loss') as losses,
      count(*) filter (where p.result = 'draw') as draws,
      avg(p.margin) as average_score_difference
    from players p group by p.faction_id
  ), commander_selections as (
    -- Multiple copies of a commander type count once per army/match.
    select distinct c.match_identifier, c.player_slot, c.commander_type_id
    from public.match_commanders c
    join players p on p.match_identifier = c.match_identifier and p.player_slot = c.player_slot
  ), commanders as (
    select p.faction_id, c.commander_type_id,
      count(*) as games,
      count(*) filter (where p.result = 'win') as wins,
      count(*) filter (where p.result = 'loss') as losses,
      count(*) filter (where p.result = 'draw') as draws,
      avg(p.margin) as average_score_difference
    from commander_selections c join players p
      on p.match_identifier = c.match_identifier and p.player_slot = c.player_slot
    group by p.faction_id, c.commander_type_id
  ), matchups as (
    select p.faction_id, opponent.faction_id as opponent_faction_id,
      count(*) as games,
      count(*) filter (where p.result = 'win') as wins,
      count(*) filter (where p.result = 'loss') as losses,
      count(*) filter (where p.result = 'draw') as draws,
      avg(p.margin) as average_score_difference
    from players p join public.match_players opponent
      on p.match_identifier = opponent.match_identifier
      and p.player_slot <> opponent.player_slot
    group by p.faction_id, opponent.faction_id
  )
  select jsonb_build_object(
    'matches', (select count(*) from complete_matches),
    'excludedMatches', (select count(*) from all_complete_matches where inferred_uploader_slot is null),
    'draws', (select count(*) from complete_matches where winner_slot is null),
    'latestMatch', (select max(recorded_utc) from complete_matches),
    'factions', coalesce((select jsonb_agg(to_jsonb(f) order by f.games desc, f.faction_id) from factions f), '[]'::jsonb),
    'commanders', coalesce((select jsonb_agg(to_jsonb(c) order by c.games desc, c.faction_id, c.commander_type_id) from commanders c), '[]'::jsonb),
    'matchups', coalesce((select jsonb_agg(to_jsonb(m) order by m.games desc, m.faction_id, m.opponent_faction_id) from matchups m), '[]'::jsonb)
  ) into statistics_payload;

  return statistics_payload;
end;
$$;

revoke all on function public.opponent_statistics() from public, anon, authenticated;
grant execute on function public.opponent_statistics() to authenticated;

commit;
