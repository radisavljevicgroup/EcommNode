-- Run this once in Supabase → SQL Editor.
--
-- Feature: premium alat "Mesečni ciljevi" (ecommnode-premium,
-- server/premium/mesecni-ciljevi). Do sada su se ciljevi i neradni dani
-- čuvali u server/data/monthly-goals*.json — po mašini, pa cilj unet na
-- produkciji nije postojao lokalno (i obrnuto). Ciljeve upisuje menadžer i
-- treba da ih vide svi, pa idu u bazu.
--
-- store_key NIJE connection id: konekcije (store.js / shopifyStore.js) su
-- lokalne i imaju drugačiji id na svakoj mašini. Ključ je domen prodavnice
-- (npr. "casiosrbija.rs", "nesto.myshopify.com"), isti svuda.
--
-- Pristup samo preko servera (service role) — RLS uključen, bez polisa.

create table public.monthly_goal_plans (
  firma_id uuid not null references public.firme(id) on delete cascade,
  store_key text not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  target_orders numeric not null,
  cr_low numeric,
  cr_high numeric,
  roas numeric,
  mer numeric,
  updated_at timestamptz not null default now(),
  primary key (firma_id, store_key, month)
);

alter table public.monthly_goal_plans enable row level security;

-- Neradni dani po firmi i mesecu (važe za sve prodavnice firme):
-- added = [{ date, note }] dodatni neradni dani, removed = [date] državni
-- praznici koji su radni.
create table public.monthly_goal_days (
  firma_id uuid not null references public.firme(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  added jsonb not null default '[]',
  removed jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (firma_id, month)
);

alter table public.monthly_goal_days enable row level security;
