-- Run this once in Supabase → SQL Editor, AFTER reading every numbered
-- step — this restructures how a "company" is represented and re-derives
-- data from public.users, which has real production rows.
--
-- Problem this fixes: pib and the company-scoping key have both lived on
-- public.users so far (see supabase-pib-unique-migration.sql) — one flat
-- table standing in for both "the company" and "a person in it". That
-- forces every worker row to fake a NULL pib and inherit the owner's
-- `token`, and gives a real company no place of its own to hold things
-- like its display name.
--
-- New shape:
--   firme         — one row per real registered company. pib lives here
--                   now, UNIQUE, and only here.
--   users         — gets `firma_id` (FK → firme.id). NOT unique — many
--                   workers share one firma_id. role_id / full_name /
--                   phone / photo are untouched.
--   timovi,
--   korisnik_tim  — new, additive, optional team grouping within a firma.
--                   No existing data depends on these.
--
-- `token` (the column that currently scopes every business-data route via
-- req.company — see server/lib/auth.js) is superseded by `firma_id`: same
-- job, but backed by a real foreign key instead of a bare UUID with no
-- table behind it. This migration does NOT drop token/pib/company on
-- users — that's step 10, commented out, run only after confirming every
-- server route and Settings.jsx is deployed and reading firma_id.

-- 1. The company table itself.
create table public.firme (
  id uuid primary key default gen_random_uuid(),
  pib text not null unique check (pib ~ '^[0-9]{8,9}$'),
  naziv text not null default '',
  created_at timestamptz not null default now()
);

-- 2. One firma per existing distinct pib (today's "owner" rows — workers
--    already have pib = null, see supabase-pib-unique-migration.sql step
--    4, so this only picks up real registrants). Backfill naziv from the
--    old free-text `company` column where it looks like a real value.
insert into public.firme (pib, naziv)
select pib, coalesce(company, '')
from public.users
where pib is not null and pib <> '';

-- 3. Link every user to their firma. Owners match by their own pib;
--    workers match by sharing their owner's `token` (workers.js copies
--    the owner's token onto every worker it creates — that's still the
--    only reliable link between a worker and their company at this point).
alter table public.users add column if not exists firma_id uuid references public.firme(id);

update public.users u
set firma_id = f.id
from public.firme f
where u.pib = f.pib;

update public.users u
set firma_id = owner.firma_id
from public.users owner
where u.firma_id is null
  and owner.firma_id is not null
  and owner.token = u.token
  and owner.id <> u.id;

-- 4. ⚠ Check before continuing — every row should now have a firma_id. If
--    this returns any rows, stop and fix them by hand (most likely cause:
--    a worker whose token doesn't match any owner's token, e.g. the owner
--    account was deleted or never had pib set) before step 5 enforces
--    NOT NULL.
select id, full_name, token from public.users where firma_id is null;

-- 5. Once step 4 returns zero rows:
alter table public.users alter column firma_id set not null;

-- 6. Workers must never set their own firma — only the signup trigger
--    (security definer, step 10) and workers.js (service-role key) assign
--    it.
revoke update (firma_id) on public.users from authenticated;

-- 7. firme RLS — members can see their own firma's row; naziv is editable
--    by manager-level roles in that firma; pib is locked at the grant
--    level regardless of any policy (same defense-in-depth pattern as
--    step 6 of the pib-unique migration).
alter table public.firme enable row level security;

create policy "Members can view own firma" on public.firme
  for select using (
    id in (select firma_id from public.users where id = auth.uid())
  );

create policy "Managers can rename own firma" on public.firme
  for update using (
    id in (
      select u.firma_id from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid()
        and r.name in ('E-commerce Manager', 'E-commerce Operations Manager', 'CEO')
    )
  );

revoke update (pib) on public.firme from authenticated;

-- 8. Teams — additive, no existing data touches these. A tim belongs to
--    exactly one firma; korisnik_tim is the many-to-many membership.
create table public.timovi (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firme(id) on delete cascade,
  naziv text not null,
  created_at timestamptz not null default now()
);

create table public.korisnik_tim (
  korisnik_id uuid not null references public.users(id) on delete cascade,
  tim_id uuid not null references public.timovi(id) on delete cascade,
  primary key (korisnik_id, tim_id)
);

alter table public.timovi enable row level security;
alter table public.korisnik_tim enable row level security;

create policy "Members can view own firma's teams" on public.timovi
  for select using (
    firma_id in (select firma_id from public.users where id = auth.uid())
  );

create policy "Members can view own team memberships" on public.korisnik_tim
  for select using (
    tim_id in (
      select t.id from public.timovi t
      where t.firma_id in (select firma_id from public.users where id = auth.uid())
    )
  );

-- 9. Signup trigger: a pib in metadata means "register a new company" —
--    create its firme row (pib uniqueness naturally rejects duplicates,
--    same UX as the old users_pib_key violation, now firme_pib_key — see
--    app/src/pages/Register.jsx's error matching) and link the new user
--    to it. No pib in metadata (workers.js's admin-created accounts) —
--    leave firma_id null; workers.js sets it right after creation, same
--    as it already does for `token` today.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_role_id uuid;
  new_pib text;
  new_firma_id uuid;
begin
  select id into default_role_id from public.roles where name = 'E-commerce Manager';
  new_pib := nullif(new.raw_user_meta_data->>'pib', '');

  if new_pib is not null then
    insert into public.firme (pib, naziv)
    values (new_pib, coalesce(new.raw_user_meta_data->>'company_name', ''))
    returning id into new_firma_id;
  end if;

  insert into public.users (id, full_name, phone, role_id, firma_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    default_role_id,
    new_firma_id
  );
  return new;
end;
$$;

-- 10. Cleanup — DO NOT run until every server route and Settings.jsx is
--     confirmed reading firma_id, not token/pib/company, on users. Then:
-- alter table public.users drop column token;
-- alter table public.users drop column pib;
-- alter table public.users drop column company;
