-- How the user wants Lis to speak to them. Written only by the user, from the
-- companion settings screen.
--
-- Deliberately NOT permission-gated, unlike mus_context_permissions. Those
-- domains guard life data that happens to be stored; this table contains no
-- life data by construction — a name, pronouns, four dials, and a short
-- self-description someone typed for the express purpose of being read. Gating
-- it behind a domain that defaults false would mean the persona silently does
-- not apply for every new user, which is the bug this whole line of work is
-- closing, not one to introduce.
--
-- Server-only, like mus_context_permissions and unlike compasses: it is
-- settings, not content, so it carries no server_seq, no tombstone, and no
-- entry in the bidirectional sync contract.

create table public.lis_companion_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  pronouns text,
  language_register text not null default 'match_me',
  encouragement smallint not null default 1,
  accountability smallint not null default 1,
  humor smallint not null default 1,
  proactivity smallint not null default 1,
  about_me text,
  avoid_topics text[] not null default '{}',
  provenance text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint lis_companion_profile_name_len
    check (display_name is null or char_length(trim(display_name)) between 1 and 40),
  constraint lis_companion_profile_pronouns_len
    check (pronouns is null or char_length(trim(pronouns)) between 1 and 24),
  constraint lis_companion_profile_register_check
    check (language_register in ('english', 'taglish', 'match_me')),
  -- 0 / 1 / 2 across every dial: low, balanced, high. Stored as smallint rather
  -- than an enum so adding a midpoint later is not a type migration.
  constraint lis_companion_profile_dials_check
    check (encouragement between 0 and 2 and accountability between 0 and 2
       and humor between 0 and 2 and proactivity between 0 and 2),
  constraint lis_companion_profile_about_len
    check (about_me is null or char_length(trim(about_me)) between 1 and 600),
  -- Per-element length is enforced in Zod at the write route, not here: a CHECK
  -- cannot contain a subquery, and the repo's only array constraint
  -- (compasses_active_areas_check) tests containment against a fixed vocabulary,
  -- which free text cannot use. This is not an oversight.
  constraint lis_companion_profile_avoid_count
    check (cardinality(avoid_topics) <= 10),
  constraint lis_companion_profile_provenance_check
    check (provenance in ('user', 'device', 'external', 'mus_inference', 'mus_plan', 'estimate'))
);

create trigger lis_companion_profile_touch
  before insert or update on public.lis_companion_profile
  for each row execute function public.kayamo_touch_row();

alter table public.lis_companion_profile enable row level security;

create policy lis_companion_profile_select
  on public.lis_companion_profile for select to authenticated
  using (user_id = auth.uid());

create policy lis_companion_profile_insert
  on public.lis_companion_profile for insert to authenticated
  with check (user_id = auth.uid());

create policy lis_companion_profile_update
  on public.lis_companion_profile for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.lis_companion_profile from public, anon, authenticated;
grant select, insert, update on public.lis_companion_profile to authenticated;
grant all on public.lis_companion_profile to service_role;
