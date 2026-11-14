-- Update all three deployed RPCs without removing later additions to their bodies.
begin;

do $migration$
declare
  signature text;
  original_sql text;
  updated_sql text;
  old_expression constant text := 'avg(p.margin) as average_score_difference';
  new_expression constant text := 'avg(p.margin) filter (where p.result = ''win'') as average_score_difference';
begin
  foreach signature in array array[
    'public.global_statistics()',
    'public.latest_upload_statistics()',
    'public.opponent_statistics()'
  ] loop
    original_sql := pg_get_functiondef(signature::regprocedure);
    updated_sql := replace(original_sql, old_expression, new_expression);
    if updated_sql = original_sql and position(new_expression in original_sql) = 0 then
      raise exception 'Expected score-average expression not found in %. No changes applied.', signature;
    end if;
    execute updated_sql;
  end loop;
end;
$migration$;

commit;
