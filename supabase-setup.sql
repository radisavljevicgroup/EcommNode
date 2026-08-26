-- Run this once in Supabase → SQL Editor.

-- 1. Roles
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into public.roles (name) values
  ('E-commerce Manager'),
  ('E-commerce Operations Manager'),
  ('E-commerce Data Analyst'),
  ('Marketing Manager'),
  ('Warehouse worker'),
  ('Owner');

-- 2. User profiles (extends Supabase Auth's auth.users — password/email
-- stay in auth.users, this table only holds the extra registration fields)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  pib text not null check (pib ~ '^[0-9]{8,9}$'),
  role_id uuid not null references public.roles(id),
  created_at timestamptz not null default now()
);

-- 3. Auto-create the profile row + assign the default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id from public.roles where name = 'E-commerce Manager';

  insert into public.users (id, full_name, phone, pib, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'pib', ''),
    default_role_id
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Row-level security — users can only read/edit their own profile;
-- everyone logged in can read the role list (needed to show role names).
alter table public.users enable row level security;
alter table public.roles enable row level security;

create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

create policy "Roles are viewable by authenticated users" on public.roles
  for select using (auth.role() = 'authenticated');
