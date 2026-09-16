-- Run this once in Supabase → SQL Editor, AFTER creating a "personalizacija"
-- bucket (Storage → New bucket → name: personalizacija → Public bucket: OFF).
--
-- Feature: besplatni alat "Personalizacija porudžbina" — kupac (kroz prodavca,
-- na stranici Porudžbine) prilaže fajlove (npr. tekst za gravuru, sliku za
-- štampu) uz porudžbinu, samo za proizvode koje prodavac unapred označi kao
-- "personalizabilne". Da li je alat uključen i koji proizvodi ga aktiviraju
-- je obična po-firmi postavka (settings.json preko server/lib/settingsStore.js
-- — isti obrazac kao za "stale"/"unfiscalized" alate u app/src/pages/alati),
-- NE ova baza — ta podešavanja su namerno per-server/machine kao i svaka
-- druga stavka u settings.json (vidi CLAUDE.md sekciju 2/3). Ono što MORA biti
-- ovde, deljeno između local i produkcije, su stvarno prikačeni fajlovi uz
-- porudžbinu — oni su realni poslovni podaci, ne podešavanje.
--
-- connection_id i order_id NISU FK ni u jednu Supabase tabelu — obe vrednosti
-- žive u WooCommerce/Shopify (i lokalnom store.js za samu konekciju), ne u
-- ovoj bazi, pa se čuvaju kao obični tekst, isto kao što orderCallsStore.js
-- već radi za broj poziva po porudžbini.
create table public.order_personalization_files (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firme(id) on delete cascade,
  connection_id text not null,
  order_id text not null,
  product_id text not null,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_personalization_files_lookup_idx
  on public.order_personalization_files (firma_id, connection_id, order_id);

-- RLS: the app never queries this table directly from the browser — every
-- read/write goes through server/routes/personalization.js using the
-- service-role key (see server/lib/supabaseAdmin.js), which bypasses RLS
-- and does its own req.company scoping (server/lib/auth.js). This policy is
-- a backstop only, mirrored on the same "firma_id in (select firma_id from
-- users where id = auth.uid())" pattern already used for public.timovi in
-- supabase-firme-refactor-migration.sql, in case a client ever queries
-- Supabase directly with a user's own session token.
alter table public.order_personalization_files enable row level security;

create policy "Company can view own personalization files"
on public.order_personalization_files for select
using (firma_id in (select firma_id from public.users where id = auth.uid()));

create policy "Company can manage own personalization files"
on public.order_personalization_files for all
using (firma_id in (select firma_id from public.users where id = auth.uid()))
with check (firma_id in (select firma_id from public.users where id = auth.uid()));

-- Storage policies for the "personalizacija" bucket. Files are stored at
-- "<firma_id>/<connection_id>/<order_id>/<uuid>-<filename>" — unlike the
-- public "avatars" bucket, this one stays private (customer-uploaded design
-- files, not meant for public URLs); the server reads/writes it with the
-- service-role key, which already bypasses storage RLS same as it does for
-- the table above, so these policies are the same direct-client backstop.
create policy "Company can view own personalization storage files"
on storage.objects for select
using (
  bucket_id = 'personalizacija'
  and (storage.foldername(name))[1] in (
    select firma_id::text from public.users where id = auth.uid()
  )
);

create policy "Company can manage own personalization storage files"
on storage.objects for all
using (
  bucket_id = 'personalizacija'
  and (storage.foldername(name))[1] in (
    select firma_id::text from public.users where id = auth.uid()
  )
)
with check (
  bucket_id = 'personalizacija'
  and (storage.foldername(name))[1] in (
    select firma_id::text from public.users where id = auth.uid()
  )
);
