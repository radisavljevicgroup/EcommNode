-- Run this once in Supabase → SQL Editor.
--
-- Problem: every premium module folder (server/premium/<name>,
-- app/src/premium/<name>) is currently shown/mounted for EVERY firma —
-- the glob loaders (import.meta.glob) and the server's premium-mounting
-- loop in index.js only check "does this folder exist on disk", not
-- "is this firma entitled to it". That's fine while there's one premium
-- client (Eurocom), wrong the moment a second company gets its own
-- folder — Eurocom's integration shouldn't show up for anyone else, and
-- vice versa.
--
-- Fix: an explicit allowlist per firma, keyed by the module's folder name
-- (e.g. 'eurocom') — the same name already used on disk, so no separate
-- registry to keep in sync. Admin-granted only (see the revoke below) —
-- a company can't self-enable another company's module by calling the
-- API, this is a manually-arranged thing per client, not a self-service
-- toggle (that's a separate, already-existing concern — see
-- enabledPremiumTools in settings.json, which is "has this entitled
-- company turned the tool on for themselves").
alter table public.firme
  add column enabled_premium_modules text[] not null default '{}';

revoke update (enabled_premium_modules) on public.firme from authenticated;

-- Backfill: grant the real Eurocom account access to its own module.
update public.firme
set enabled_premium_modules = array['eurocom']
where pib = '102895435';
