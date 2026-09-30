-- Run this once in Supabase → SQL Editor.
--
-- Feature: premium alat "Raspodela porudžbina" (ecommnode-premium,
-- server/premium/order-distribution) — nove porudžbine se automatski
-- dodeljuju radnicima firme tako da zbir BODOVA (1 bod po stavci, 2 za
-- označene SKU-ove/kategorije) bude ravnomeran, plus analitika učinka po
-- radniku.
--
-- Za razliku od enabledPremiumTools (settings.json, per-machine), ovo MORA
-- biti u bazi: dodela porudžbine radniku je poslovni podatak koji treba da
-- vide svi (lokal i produkcija), i jedini unique constraint u bazi je ono
-- što sprečava da dva Node procesa (host ih može vrteti više, vidi
-- orderReadsStore.js) istu porudžbinu dodele dvaput.
--
-- connection_id i order_id NISU FK — žive u WooCommerce/Shopify i lokalnom
-- store.js, isto kao u order_personalization_files.

-- 1. Stanje alata po firmi. is_active je jedini prekidač koji algoritam
--    dodele gleda; activated_at je granica "nova porudžbina" — dodeljuju se
--    samo porudžbine kreirane posle poslednjeg uključivanja, pa porudžbine
--    pristigle dok je alat bio isključen ostaju nedodeljene i posle
--    ponovnog uključivanja.
create table public.order_distribution_settings (
  firma_id uuid primary key references public.firme(id) on delete cascade,
  is_active boolean not null default false,
  activated_at timestamptz,
  deactivated_at timestamptz,
  -- Od kog trenutka se broji "trenutni balans" bodova pri izboru radnika:
  --   cumulative — svi bodovi ikad dodeljeni (dugoročno izjednačavanje)
  --   daily      — samo današnji bodovi (svaki dan kreće od nule)
  --   session    — samo bodovi od poslednjeg uključivanja alata
  balance_mode text not null default 'daily'
    check (balance_mode in ('cumulative', 'daily', 'session')),
  -- Stavke koje vrede 2 boda umesto 1 — po SKU-u i/ili nazivu kategorije
  -- (nazivi, ne ID-jevi: productsCache.js čuva kategorije po nazivu).
  double_point_skus text[] not null default '{}',
  double_point_categories text[] not null default '{}',
  -- Radnici firme koji NE učestvuju u raspodeli (npr. vlasnik) — svi
  -- ostali, uključujući tek dodate radnike, učestvuju automatski.
  excluded_worker_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- 2. Jedinstvena boja + ikonica po radniku (u okviru firme), dodeljuje se
--    automatski pri prvoj potrebi. badge_index je indeks u paleti na
--    frontendu (boja i ikonica idu u paru), unique po firmi.
create table public.worker_badges (
  user_id uuid primary key references public.users(id) on delete cascade,
  firma_id uuid not null references public.firme(id) on delete cascade,
  badge_index integer not null check (badge_index >= 0),
  color text not null,
  icon text not null,
  created_at timestamptz not null default now(),
  unique (firma_id, badge_index)
);

-- 3. Dodela porudžbina. points je snimak bodova u trenutku dodele —
--    kasnija promena pravila (2-bodni SKU-ovi) ne menja istoriju, kao ni
--    gašenje alata.
create table public.order_assignments (
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

create index order_assignments_balance_idx
  on public.order_assignments (firma_id, order_created_at);
create index order_assignments_worker_idx
  on public.order_assignments (firma_id, worker_id);

-- RLS: kao i order_personalization_files — server čita/piše samo preko
-- service-role ključa (bypass RLS, sopstveni req.company scoping); politike
-- su backstop za direktan klijentski pristup sa korisničkim tokenom.
alter table public.order_distribution_settings enable row level security;
alter table public.worker_badges enable row level security;
alter table public.order_assignments enable row level security;

create policy "Company can view own distribution settings"
on public.order_distribution_settings for select
using (firma_id in (select firma_id from public.users where id = auth.uid()));

create policy "Company can view own worker badges"
on public.worker_badges for select
using (firma_id in (select firma_id from public.users where id = auth.uid()));

create policy "Company can view own order assignments"
on public.order_assignments for select
using (firma_id in (select firma_id from public.users where id = auth.uid()));
