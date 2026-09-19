# Hosted database: migrations 0013–0023 applied — 2026-09-19

Project `vfprugxigejdsyvipipf` (the production Supabase project). Run by the
owner from this repository with the Supabase CLI v2.116.0; verified read-only
by Claude before and after.

## State before

- Migration history lived in `drizzle.__drizzle_migrations` (12 rows): 0001–0012.
- 0020 (`private.web_ai_allowances`, `reserve_web_ai_request`) had been applied
  out of band; nothing recorded it.
- `supabase_migrations.schema_migrations` did not exist.
- Unapplied: 0013–0019 and 0021–0023. Visible symptoms: `goals.life_area`
  missing, the 0015 daily-plan columns missing, no identity tables, no
  `mus_context_permissions` (Lis permissions and profile returned 500), no
  `private.sync_user_counters`, `tasks_select` hiding tombstones from sync,
  table-wide UPDATE on `agent_runs` for `authenticated`.

## Procedure

1. Backups: `supabase db dump --linked -f ~/kayamo-hosted-schema.sql` (148 KB,
   42 tables) and `--data-only -f ~/kayamo-hosted-data.sql` (438 KB, 26 tables
   with rows). Kept in the owner's home folder.
2. `supabase migration repair --status applied 0001 … 0012 0020` — recorded the
   already-present migrations in the CLI history without running them.
3. `supabase db push --linked --dry-run --include-all` — listed exactly the ten
   pending files.
4. `supabase db push --linked --include-all` — applied 0013, 0014, 0015, 0016,
   0017, 0018, 0019, 0021, 0022, 0023 in order; no errors.

## State after (verified)

- `supabase migration list --linked`: every row 0001–0023 has a Remote value.
- Tables present: `compasses`, `future_selves`, `inbox_items`,
  `personal_rules`, `mus_context_permissions`, `lis_companion_profile`;
  `private.sync_user_counters` beside `private.web_ai_allowances`.
- `goals.life_area` present; the four 0015 columns on `daily_plans` present.
- `tasks_select` is `(user_id = auth.uid())`: tombstones are visible to sync.
- `agent_runs`: no table-wide UPDATE for `authenticated` or `anon`; the only
  UPDATE grant is `authenticated.scrubbed_at`.
- `mus_context_permissions_domain_check` includes `identity`.

## Decision

The Supabase CLI history is now the only migration record for the hosted
project. The Drizzle table stays as history; nothing writes to it. Future
migrations: add a file under `supabase/migrations/`, `db push --linked`.

Not yet checked: `GET /api/mus/permissions` from a signed-in session on the
hosted app. The hosted app is built from `main`, which predates this branch;
the 500s came from the missing table, which now exists.
