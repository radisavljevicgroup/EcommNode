-- Run this once in Supabase → SQL Editor.
--
-- Feature: "Asortimani" (ecommnode-premium, server/premium/asortimani) —
-- firma (dobavljač) objavi svoj asortiman, druga firma (shop) pošalje
-- zahtev, dobavljač ga odobri sa rabatom za tog shopa, i shop onda izabrane
-- artikle objavi na svom WooCommerce sajtu.
--
-- Ovo MORA biti u bazi (ne u server/data/*.json kao integracije): u svakom
-- zahtevu učestvuju DVE različite firme, i obe treba da ga vide. Sami
-- artikli se NE kopiraju ovde — čitaju se uživo iz dobavljačeve
-- WooCommerce konekcije (connection_id živi u lokalnom store.js, nije FK,
-- isto kao u order_distribution_*).
--
-- RLS je uključen bez ijedne policy — tabelama pristupa samo server
-- (service role), nikad frontend direktno.

-- 1. Ponuda dobavljača — jedna po firmi. aktivan = vidljiva drugim
--    firmama u Asortimanima; connection_id = iz koje njene WooCommerce
--    prodavnice se čitaju artikli.
create table if not exists public.asortimani_ponude (
  firma_id uuid primary key references public.firme(id) on delete cascade,
  naziv text not null default '',
  opis text not null default '',
  aktivan boolean not null default false,
  connection_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Zahtev shopa za pristup asortimanu dobavljača — jedan po paru firmi;
--    novi zahtev posle odbijanja/ukidanja samo vraća isti red na
--    "na_cekanju". rabat (%) postavlja dobavljač pri odobrenju i važi samo
--    za tog shopa.
create table if not exists public.asortimani_zahtevi (
  id uuid primary key default gen_random_uuid(),
  dobavljac_firma_id uuid not null references public.firme(id) on delete cascade,
  shop_firma_id uuid not null references public.firme(id) on delete cascade,
  status text not null default 'na_cekanju'
    check (status in ('na_cekanju', 'odobren', 'odbijen', 'ukinut')),
  rabat numeric(5, 2) not null default 0 check (rabat >= 0 and rabat < 100),
  poruka text not null default '',
  created_at timestamptz not null default now(),
  odgovoreno_at timestamptz,
  unique (dobavljac_firma_id, shop_firma_id),
  check (dobavljac_firma_id <> shop_firma_id)
);

create index if not exists asortimani_zahtevi_shop_idx on public.asortimani_zahtevi (shop_firma_id);

alter table public.asortimani_ponude enable row level security;
alter table public.asortimani_zahtevi enable row level security;
