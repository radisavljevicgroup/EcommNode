-- Run this once in Supabase → SQL Editor.
--
-- Two separate concerns, previously conflated into one free-text `company`
-- column that any user could edit directly (Settings) to any value and
-- see that company's entire dataset:
--
--   - pib   : the account's OWN real registration PIB. Unique — one real
--             company per pib. NULL for worker rows (workers don't
--             register their own company, see below).
--   - token : a randomly generated value that actually scopes data
--             access. Not derived from pib on purpose — pib is public
--             information (invoices, APR registry), so even locked down
--             from direct writes it's a weaker identifier to build
--             isolation on than an opaque random token. Unique only at
--             the point an owner registers (that's what makes it safe to
--             use as a scoping key) — every worker added to that company
--             gets that SAME owner's token copied onto their own row on
--             purpose, so it is NOT unique table-wide once workers exist.
--
-- Workers already get the owner's pib copied onto their own row today
-- (server/routes/workers.js, before this migration's app-code change) —
-- so any company with 1+ workers already has duplicate pib values. This
-- migration has to unwind that before pib can become unique.

-- 1. Token column — every row gets its own random value by default.
alter table public.users
  add column if not exists token uuid not null default gen_random_uuid();

-- 2. pib was `not null` from the original schema (back when every account
--    was assumed to be its own company). Workers no longer get one, so
--    that constraint has to go — the format check constraint is
--    untouched and still applies to every non-null value.
alter table public.users alter column pib drop not null;

-- 3. Propagate the ORIGINAL registrant's token onto every worker that was
--    created under them — identified by today's duplicate-pib groups
--    (a side effect of the pre-migration copy-on-invite behavior).
--    Earliest `created_at` per group = the presumed original registrant.
--    ⚠ Review before running: if you know a case where this heuristic
--    picks the wrong row as "the owner" for a given company, fix that row
--    by hand after running this, before step 5 locks pib down.
with groups as (
  select id, pib, token,
         first_value(token) over (partition by pib order by created_at asc) as owner_token,
         row_number() over (partition by pib order by created_at asc) as rn
  from public.users
  where pib is not null and pib <> ''
)
update public.users u
set token = g.owner_token
from groups g
where u.id = g.id and g.rn > 1;

-- 4. Null out pib on those same non-owner rows — a worker doesn't have
--    their own registration PIB, only inherits the owner's token.
with ranked as (
  select id, pib,
         row_number() over (partition by pib order by created_at asc) as rn
  from public.users
  where pib is not null and pib <> ''
)
update public.users u
set pib = null
from ranked r
where u.id = r.id and r.rn > 1;

-- 5. One real company per pib, now safe to enforce. (token deliberately
--    gets NO unique constraint — see the note at the top: it's shared
--    on purpose between an owner and their workers, so it's only unique
--    among owners, same as pib.)
alter table public.users add constraint users_pib_key unique (pib);

-- 6. Lock down client-side writes to both scoping-relevant columns —
--    the actual fix for "type any company name into Settings and see
--    their data". Legitimate paths (signup trigger, workers.js's
--    admin/service-role calls) don't go through the `authenticated`
--    role, so this doesn't block them.
revoke update (company, token) on public.users from authenticated;

-- 7. Signup trigger: was coalescing a missing pib to '' — harmless while
--    pib was not-null, but '' fails the format check constraint now that
--    workers.js creates worker accounts with no pib in their metadata at
--    all. Insert NULL instead when it's absent. token needs no change
--    here — it's populated by the column default (gen_random_uuid()).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id from public.roles where name = 'E-commerce Manager';

  insert into public.users (id, full_name, phone, pib, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'pib', ''),
    default_role_id
  );
  return new;
end;
$$;
