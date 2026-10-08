-- Run this once in Supabase → SQL Editor (posle supabase-asortimani-migration.sql).
--
-- Asortimani: dobavljač bira odakle dolaze artikli i šta deli.
--   izvor         — 'woo' (njegova povezana WooCommerce prodavnica,
--                   connection_id) ili 'api' (njegov sopstveni REST API —
--                   link, token i mapiranje polja su u server/data/
--                   asortimani-api-izvori.json na serveru, NE ovde, jer je
--                   token tajna; isto pravilo kao za ostale integracije)
--   cena_tip      — za 'woo': 'regular' (redovna cena) ili 'sale' (aktuelna,
--                   sa akcijom). Za 'api' cenu bira mapiranje polja.
--   zaliha_prikaz — 'puna' (tačna količina) ili 'rang' (shop vidi samo
--                   <10 / 10+ / 100+ / 1000+, nikad tačan broj)

alter table public.asortimani_ponude
  add column if not exists izvor text not null default 'woo' check (izvor in ('woo', 'api')),
  add column if not exists cena_tip text not null default 'regular' check (cena_tip in ('regular', 'sale')),
  add column if not exists zaliha_prikaz text not null default 'puna' check (zaliha_prikaz in ('puna', 'rang'));
