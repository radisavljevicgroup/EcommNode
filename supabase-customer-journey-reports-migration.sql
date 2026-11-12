-- Run this once in Supabase → SQL Editor (posle
-- supabase-customer-journey-migration.sql).
--
-- Feature: "Put kupca" faza 5 — dnevni i nedeljni izveštaj po prodavnici
-- (ecommnode-premium, server/premium/customer-journey/reports.js). Izveštaj
-- se pravi iz pravila (bez AI-ja) i čuva ceo, kao JSON: zbir, poređenje sa
-- prethodnim periodom, preporuke i opis puta po porudžbini. Bez ličnih
-- podataka kupaca — samo broj porudžbine, iznos i anonimni put.

create table public.journey_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.journey_shops(id) on delete cascade,
  period_type text not null check (period_type in ('daily', 'weekly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (shop_id, period_type, period_start)
);

create index journey_reports_lookup_idx
  on public.journey_reports (shop_id, period_type, period_start desc);

alter table public.journey_reports enable row level security;

create policy "Company can view own journey reports"
on public.journey_reports for select
using (shop_id in (
  select s.id from public.journey_shops s
  join public.users u on u.firma_id = s.firma_id
  where u.id = auth.uid()
));
