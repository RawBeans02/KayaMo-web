-- Trusted, atomic request allowance. Separate from user-editable/synced telemetry.
-- No health content is stored. The UTC day comes from the database clock.
create schema if not exists private;
create table if not exists private.web_ai_allowances (
  user_id uuid not null references auth.users(id) on delete cascade,
  utc_day date not null,
  requests integer not null check (requests >= 0),
  primary key (user_id, utc_day)
);
revoke all on private.web_ai_allowances from public, anon, authenticated;

create or replace function public.reserve_web_ai_request(p_user_id uuid, p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare claimed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server only' using errcode = '42501';
  end if;
  if p_user_id is null or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'invalid allowance' using errcode = '22023';
  end if;
  insert into private.web_ai_allowances as allowance (user_id, utc_day, requests)
  values (p_user_id, (clock_timestamp() at time zone 'UTC')::date, 1)
  on conflict (user_id, utc_day) do update
    set requests = allowance.requests + 1
    where allowance.requests < p_daily_limit
  returning requests into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.reserve_web_ai_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_web_ai_request(uuid, integer) to service_role;
