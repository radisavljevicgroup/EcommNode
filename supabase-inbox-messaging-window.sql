-- Run this once in Supabase → SQL Editor, after supabase-inbox-setup.sql.
-- Tracks when the customer last actually wrote in, separate from
-- last_message_at (which also moves on our own outbound replies and so
-- can't tell "is Meta's 24h messaging window still open"). Set only by
-- saveInboundMessage in server/lib/inboxStore.js.

alter table public.inbox_conversations
  add column if not exists last_inbound_at timestamptz;
