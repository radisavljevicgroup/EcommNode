-- Run this once in Supabase → SQL Editor.
--
-- Feature: premium modul "Put kupca" (ecommnode-premium,
-- server/premium/customer-journey). Tracker na prodavnici (WordPress plugin /
-- Shopify app) šalje anonimne događaje sesije na POST /collect; ovde se
-- čuvaju da bi se kasnije spojili sa porudžbinom i opisali put do kupovine.
--
-- Mora u bazu (ne u lokalni server/data/*.json): događaje prima produkcioni
-- server, a čita ih svaki proces, i lokal i produkcija.
--
-- PRIVATNOST: tabela namerno nema kolonu za IP, ime, mejl, telefon ni
-- sadržaj formi — server ih odbacuje pre upisa (sanitize.js). Događaji
-- stariji od 90 dana se brišu automatski (retention.js).

-- 1. Prodavnica koja šalje događaje. shop_key je javni identifikator (stoji
--    u HTML-u prodavnice, nije tajna) — pravu zaštitu daje allowed_origins:
--    /collect prihvata zahtev samo ako je Origin na toj listi.
--    site_url, ne connection_id: konekcije (store.js / shopifyStore.js) su
--    lokalni JSON po mašini i imaju različite ID-jeve lokalno i na
--    produkciji; spajanje sa konekcijom ide po URL-u prodavnice.
create table public.journey_shops (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firme(id) on delete cascade,
  platform text not null check (platform in ('woocommerce', 'shopify')),
  site_url text not null,
  name text,
  shop_key text not null unique,
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (firma_id, site_url)
);

-- 2. Događaji. ts = vreme na uređaju kupca (redosled u sesiji),
--    received_at = kad je stiglo na server. order_id je popunjen samo za
--    purchase (spajanje sa porudžbinom, faza 4).
create table public.journey_events (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.journey_shops(id) on delete cascade,
  session_id uuid not null,
  ts timestamptz not null,
  received_at timestamptz not null default now(),
  type text not null check (type in (
    'session_start', 'page_view', 'click', 'scroll', 'product_view',
    'add_to_cart', 'checkout_start', 'purchase'
  )),
  url text,
  page_type text check (page_type in (
    'home', 'collection', 'product', 'cart', 'checkout', 'search', 'other'
  )),
  location text,
  item_id text,
  position integer,
  value numeric,
  order_id text,
  meta jsonb not null default '{}'
);

create index journey_events_session_idx
  on public.journey_events (shop_id, session_id, ts);
create index journey_events_shop_ts_idx
  on public.journey_events (shop_id, ts);
create index journey_events_ts_idx
  on public.journey_events (ts);
create index journey_events_order_idx
  on public.journey_events (shop_id, order_id)
  where order_id is not null;

-- RLS: kao i ostali premium moduli — server čita/piše preko service-role
-- ključa (bypass RLS, sopstveni req.company scoping); politike su backstop
-- za direktan klijentski pristup sa korisničkim tokenom.
alter table public.journey_shops enable row level security;
alter table public.journey_events enable row level security;

create policy "Company can view own journey shops"
on public.journey_shops for select
using (firma_id in (select firma_id from public.users where id = auth.uid()));

create policy "Company can view own journey events"
on public.journey_events for select
using (shop_id in (
  select s.id from public.journey_shops s
  join public.users u on u.firma_id = s.firma_id
  where u.id = auth.uid()
));
