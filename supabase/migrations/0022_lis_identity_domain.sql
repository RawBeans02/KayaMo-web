-- A fifth context domain: what the user has told us about who they are.
--
-- Migration 0014 built future_selves, compasses, personal_rules and inbox_items
-- with privacy_level / provenance / mus_may_read / mus_may_remember columns, and
-- then no server code ever read any of them. This gives those columns their
-- first reader.
--
-- The domain grant is necessary but NOT sufficient. RLS cannot enforce the
-- per-row flag — the user owns these rows, so the policy that lets them read
-- their own compass also lets the server read it on their behalf. Honouring
-- `mus_may_read` is therefore a loader responsibility, and it has a test.
--
-- inbox_items is deliberately excluded. It defaults mus_may_read = false, it is
-- raw unreviewed capture, and it is the highest-risk prompt-injection surface in
-- the schema.

alter table public.mus_context_permissions
  drop constraint if exists mus_context_permissions_domain_check;

alter table public.mus_context_permissions
  add constraint mus_context_permissions_domain_check
  check (domain in ('goals_planning', 'physical_self', 'memory', 'faith', 'identity'));
