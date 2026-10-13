-- Run this once in Supabase → SQL Editor (baza je deljena local/produkcija).
--
-- Feature: Raspodela porudžbina → sektor "Magacin" (ecommnode-premium,
-- server/premium/order-distribution). Pored radnika koji REALIZUJE
-- porudžbinu (order_assignments), svaka porudžbina dobija i radnika koji je
-- PAKUJE — magacioneri (rola "Warehouse worker") su zaseban sektor sa istim
-- pravilima (odmor, radnik koji radi sve, posebni artikli, po prodavnicama,
-- bodovi), ali sa svojim balansom.
--
-- Posebna tabela, iste kolone kao order_assignments, umesto kolone "sektor"
-- u postojećoj: tako order_assignments i sve što je čita ostaju netaknuti,
-- a jedan red po porudžbini po sektoru (unique ispod) i dalje sprečava da
-- dva Node procesa istu porudžbinu dodele dvaput.
--
-- Pravila sektora Magacin se čuvaju u postojećoj koloni
-- order_distribution_settings.routing_rules (ključ "packing") — za to ne
-- treba migracija. Bez ove tabele realizacija radi kao i pre, a raspodela
-- pakovanja javlja da ova migracija nije pokrenuta.

create table if not exists public.order_packing_assignments (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firme(id) on delete cascade,
  connection_id text not null,
  order_id text not null,
  order_number text,
  worker_id uuid references public.users(id) on delete set null,
  points integer not null check (points >= 0),
  item_count integer not null default 0,
  order_created_at timestamptz not null,
  assigned_at timestamptz not null default now(),
  unique (firma_id, connection_id, order_id)
);

create index if not exists order_packing_assignments_balance_idx
  on public.order_packing_assignments (firma_id, order_created_at);
create index if not exists order_packing_assignments_worker_idx
  on public.order_packing_assignments (firma_id, worker_id);

-- RLS: isto kao order_assignments — server koristi service-role ključ,
-- politika je backstop za direktan klijentski pristup.
alter table public.order_packing_assignments enable row level security;

create policy "Company can view own packing assignments"
on public.order_packing_assignments for select
using (firma_id in (select firma_id from public.users where id = auth.uid()));
