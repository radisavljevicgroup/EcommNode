-- Run this once in Supabase → SQL Editor, after supabase-inbox-setup.sql.
-- Adds the sender's profile photo and the label of which of our own
-- accounts (Page / IG business account / WhatsApp number) the message
-- came in on, so the inbox sidebar can show both under the avatar.

alter table public.inbox_conversations
  add column if not exists sender_avatar_url text,
  add column if not exists account_label text;
