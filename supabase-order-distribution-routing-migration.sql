-- Pravila raspodele porudžbina (Učinak radnika → Pravila raspodele), sve u
-- jednoj jsonb koloni — čita/piše ih samo server (order-distribution
-- premium modul, store.js), po firmi:
--   {
--     "onLeaveWorkerIds": ["<user id>", ...],      -- 1. na odmoru: van raspodele dok se ne vrate
--     "globalOverrideWorkerId": "<user id>" | null, -- 2. jedan radnik dobija SVE porudžbine
--     "specialRules": [                            -- 3. artikli/kategorije zaduženog radnika
--       { "id": "...", "workerId": "<user id>", "skus": ["..."], "categories": ["..."] }
--     ]
--   }
-- 4. Sve ostalo ide standardnom raspodelom po bodovima među aktivnim radnicima.
--
-- Pokrenuti jednom u Supabase SQL Editor-u (baza je deljena local/produkcija).
-- Bez ove kolone stranica radi kao i pre, samo čuvanje pravila javlja grešku.

alter table public.order_distribution_settings
  add column if not exists routing_rules jsonb not null default '{}'::jsonb;
