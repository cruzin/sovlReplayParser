-- Run in SQL Editor after the original ingest_match function exists.
-- Replace only its known UUID guard, preserving validation and atomic inserts.
begin;

do $migration$
declare
  function_sql text;
  updated_sql text;
begin
  function_sql := pg_get_functiondef('public.ingest_match(jsonb)'::regprocedure);
  updated_sql := regexp_replace(
    function_sql,
    'if\s+auth\.uid\(\)\s+is\s+distinct\s+from\s+''b424b4a7-751b-4dac-9a6b-8840c7720777''::uuid\s+then',
    'if auth.uid() is null or auth.role() is distinct from ''authenticated'' then',
    'i'
  );

  if updated_sql = function_sql then
    if position('if auth.uid() is null or auth.role() is distinct from ''authenticated'' then' in function_sql) = 0 then
      raise exception 'Expected uploader UUID guard not found. No changes applied; inspect public.ingest_match(jsonb).';
    end if;
  else
    execute updated_sql;
  end if;
end;
$migration$;

revoke all on function public.ingest_match(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.ingest_match(jsonb) to authenticated;

commit;
