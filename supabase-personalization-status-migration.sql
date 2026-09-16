-- Run this once in Supabase → SQL Editor, AFTER
-- supabase-personalization-migration.sql.
--
-- Tracks whether an order's personalization (e.g. graviranje) has been
-- finished. Deliberately its own table rather than a column on
-- order_personalization_files: "done" is a property of the whole order (one
-- engraving job), not of any individual file — an order can have a .png AND
-- a .dxf attached and still be one single job to mark complete.
--
-- Presence of a row = done. There's no "pending" row to insert — an order
-- counts as pending simply by having files in order_personalization_files
-- and no matching row here (see server/lib/personalizationStore.js).
create table public.order_personalization_completions (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firme(id) on delete cascade,
  connection_id text not null,
  order_id text not null,
  completed_by uuid references public.users(id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (firma_id, connection_id, order_id)
);

create index order_personalization_completions_lookup_idx
  on public.order_personalization_completions (firma_id, connection_id, order_id);

-- RLS backstop — see supabase-personalization-migration.sql's comment on
-- order_personalization_files for why this mirrors the same policy shape
-- even though the app only ever talks to this table via the service-role
-- key in server/routes/personalization.js.
alter table public.order_personalization_completions enable row level security;

create policy "Company can view own personalization completions"
on public.order_personalization_completions for select
using (firma_id in (select firma_id from public.users where id = auth.uid()));

create policy "Company can manage own personalization completions"
on public.order_personalization_completions for all
using (firma_id in (select firma_id from public.users where id = auth.uid()))
with check (firma_id in (select firma_id from public.users where id = auth.uid()));
