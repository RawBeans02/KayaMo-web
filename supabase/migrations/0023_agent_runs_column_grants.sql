-- agent_runs: keep row scoping, remove column-wide user writes.
--
-- The per-user AI budget reads cost_usd from agent_runs. RLS answers which rows
-- a user may touch, not which columns: agent_runs_update let a signed-in user
-- rewrite any column of their own rows, including cost_usd and tokens, so the
-- spend ceiling could be zeroed from the client by calling PostgREST directly.
-- The request-count allowance in the private schema was the only trustworthy
-- limit.
--
-- Users legitimately change one column on their own runs: scrubbed_at, when
-- they clear a run's payload. Grant exactly that. Inserts are unchanged: the
-- server writes telemetry through the user's session. The update policy stays
-- as the row filter; column privilege is checked in addition to it.

revoke update on table public.agent_runs from authenticated, anon;
grant update (scrubbed_at) on table public.agent_runs to authenticated;
