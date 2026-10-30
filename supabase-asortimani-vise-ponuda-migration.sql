-- Run this once in Supabase → SQL Editor (posle supabase-asortimani-izvor-migration.sql),
-- U ISTO VREME kad se deploy-uje kod koji ga koristi (ecommnode-premium
-- "Asortimani: više asortimana po integraciji") — baza je deljena između
-- local-a i produkcije, a stari kod posle ove migracije ne može da sačuva
-- ponudu ni da pošalje zahtev.
--
-- Asortimani: firma može imati VIŠE ponuda (asortimana), npr. iz iste
-- WooCommerce prodavnice jedan samo za brend Casio, drugi samo za
-- kategoriju "Školski pribor". Svaka ima svoj id, filter i svoje zahteve
-- (rabat se određuje po asortimanu).
--   filter_tip       — 'svi' (ceo katalog izvora), 'brend' ili 'kategorija'
--   filter_vrednosti — izabrani brendovi / nazivi kategorija (bilo koji od njih)
--
-- Postojeća ponuda dobija id = firma_id, pa lokalni server/data JSON
-- (mapiranje kategorija, automatsko postavljanje) ključevan po id-u
-- dobavljača i dalje važi bez ikakve izmene.

alter table public.asortimani_ponude
  add column if not exists id uuid,
  add column if not exists filter_tip text not null default 'svi'
    check (filter_tip in ('svi', 'brend', 'kategorija')),
  add column if not exists filter_vrednosti text[] not null default '{}';

update public.asortimani_ponude set id = firma_id where id is null;

alter table public.asortimani_ponude
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.asortimani_ponude drop constraint if exists asortimani_ponude_pkey;
alter table public.asortimani_ponude add constraint asortimani_ponude_pkey primary key (id);
create index if not exists asortimani_ponude_firma_idx on public.asortimani_ponude (firma_id);

-- Zahtev je sada za jedan asortiman, ne za celu firmu.
alter table public.asortimani_zahtevi
  add column if not exists ponuda_id uuid references public.asortimani_ponude(id) on delete cascade;

update public.asortimani_zahtevi z
  set ponuda_id = z.dobavljac_firma_id
  where z.ponuda_id is null
    and exists (select 1 from public.asortimani_ponude p where p.id = z.dobavljac_firma_id);

-- Zahtevi ka firmi koja nema ponudu (ne bi trebalo da postoje).
delete from public.asortimani_zahtevi where ponuda_id is null;

alter table public.asortimani_zahtevi alter column ponuda_id set not null;
alter table public.asortimani_zahtevi
  drop constraint if exists asortimani_zahtevi_dobavljac_firma_id_shop_firma_id_key;
alter table public.asortimani_zahtevi drop constraint if exists asortimani_zahtevi_ponuda_shop_key;
alter table public.asortimani_zahtevi
  add constraint asortimani_zahtevi_ponuda_shop_key unique (ponuda_id, shop_firma_id);
