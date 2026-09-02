-- Run this once in Supabase → SQL Editor.
-- Backs the "Poruke" (Messages) inbox: unified conversations/messages from
-- Meta's Messenger, Instagram Direct, and WhatsApp Business webhooks.

create table public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook', 'instagram', 'whatsapp')),
  sender_id text not null,
  sender_name text,
  page_id text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (platform, sender_id, page_id)
);

create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  message_id text not null,
  platform text not null check (platform in ('facebook', 'instagram', 'whatsapp')),
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_id text not null,
  sender_name text,
  text text,
  status text not null default 'received' check (
    status in ('received', 'sent', 'delivered', 'read', 'failed')
  ),
  created_at timestamptz not null default now(),
  unique (platform, message_id)
);

create index inbox_messages_conversation_id_idx on public.inbox_messages (conversation_id, created_at);
create index inbox_conversations_last_message_at_idx on public.inbox_conversations (last_message_at desc);

-- The backend talks to these tables with the Supabase service role key
-- (server/lib/supabaseAdmin.js), which bypasses RLS entirely — these
-- policies only matter if the tables are ever queried from the browser
-- with the anon/user key.
alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;

create policy "Authenticated can read conversations" on public.inbox_conversations
  for select using (auth.role() = 'authenticated');

create policy "Authenticated can read messages" on public.inbox_messages
  for select using (auth.role() = 'authenticated');
