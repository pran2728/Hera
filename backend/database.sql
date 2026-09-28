-- Hera database: paste into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- 1. Her profile: onboarding answers. One row per woman.
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  name              text,
  life_stage        text check (life_stage in ('cycles','ttc','pregnant','perimenopause','postmenopause')),
  last_period_start date,
  cycle_length      int  check (cycle_length between 15 and 90),
  cycle_length_known boolean default false,
  period_length     int  default 5 check (period_length between 1 and 15),
  contraception     text,
  conditions        text[] default '{}',
  diet              text,
  allergies         text,
  tone              text default 'bestie' check (tone in ('bestie','gentle','facts')),
  consent_at        timestamptz,
  onboarded_at      timestamptz,
  created_at        timestamptz default now()
);

-- 1b. More about her, editable on the My Profile screen (added later; safe to re-run).
alter table public.profiles add column if not exists age int check (age between 18 and 120);
alter table public.profiles add column if not exists favourite_foods text;
alter table public.profiles add column if not exists activity_level text
  check (activity_level in ('sedentary','light','active','very_active'));
alter table public.profiles add column if not exists goals text[] default '{}';
alter table public.profiles add column if not exists about_me text;

-- 2. The chat history.
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','hera')),
  content     text not null,
  created_at  timestamptz default now()
);
create index if not exists messages_user_time on public.messages (user_id, created_at desc);

-- 3. Everything Hera logs from chat: periods, pain, mood, symptoms.
create table if not exists public.cycle_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date    date not null,
  kind        text not null check (kind in
                ('period_start','period_end','flow','pain','mood','energy','symptom','sleep','sex_drive','note')),
  value       text,
  created_at  timestamptz default now()
);
create index if not exists cycle_logs_user_date on public.cycle_logs (user_id, log_date desc);

-- 4. Security: each woman can only ever see and change her own rows.
alter table public.profiles   enable row level security;
alter table public.messages   enable row level security;
alter table public.cycle_logs enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own logs" on public.cycle_logs;
create policy "own logs" on public.cycle_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Open these tables to signed-in users only (never to anonymous visitors).
grant select, insert, update, delete on public.profiles, public.messages, public.cycle_logs to authenticated;
revoke all on public.profiles, public.messages, public.cycle_logs from anon;
