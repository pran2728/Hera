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

-- 1c. Reminder settings and trusted contact (Milestone 2; safe to re-run).
alter table public.profiles add column if not exists timezone text default 'Asia/Kolkata';
alter table public.profiles add column if not exists nudge_time text default '09:00';
alter table public.profiles add column if not exists checkin_day int default 0 check (checkin_day between 0 and 6);
alter table public.profiles add column if not exists daily_tips boolean default false;
alter table public.profiles add column if not exists quiet_start text default '22:00';
alter table public.profiles add column if not exists quiet_end text default '08:00';
alter table public.profiles add column if not exists paused_until timestamptz;
alter table public.profiles add column if not exists trusted_name text;
alter table public.profiles add column if not exists trusted_phone text;

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

-- 3b. Phones and laptops that asked for Hera's notifications.
create table if not exists public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

-- 3c. Which reminders were already sent, so none repeats.
create table if not exists public.nudges_sent (
  user_id   uuid not null references auth.users(id) on delete cascade,
  kind      text not null,
  for_date  date not null,
  sent_at   timestamptz default now(),
  primary key (user_id, kind, for_date)
);

-- 3d. Hera's private settings (notification keys, schedule secret). No app user can read this.
create table if not exists public.hera_settings (
  key    text primary key,
  value  text not null
);
insert into public.hera_settings (key, value)
values ('cron_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

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

alter table public.push_subscriptions enable row level security;
alter table public.nudges_sent        enable row level security;
alter table public.hera_settings      enable row level security;

drop policy if exists "own devices" on public.push_subscriptions;
create policy "own devices" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own nudges" on public.nudges_sent;
create policy "own nudges" on public.nudges_sent
  for select to authenticated using (user_id = auth.uid());
-- hera_settings has no policies on purpose: only Hera's server functions can use it.

-- 5. Open these tables to signed-in users only (never to anonymous visitors).
grant select, insert, update, delete on public.profiles, public.messages, public.cycle_logs to authenticated;
revoke all on public.profiles, public.messages, public.cycle_logs from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.nudges_sent to authenticated;
revoke all on public.push_subscriptions, public.nudges_sent, public.hera_settings from anon;
revoke all on public.hera_settings from authenticated;

-- 6. Hera's server functions (background reminders) need full access.
grant select, insert, update, delete on public.profiles, public.messages, public.cycle_logs,
  public.push_subscriptions, public.nudges_sent, public.hera_settings to service_role;

-- ================= Milestone 3: Partner mode (safe to re-run) =================
-- She invites one partner with a link. The partner gets gentle nudges (period heads-up,
-- weekly tip, a crisis alert if she turns it on) and NEVER sees her chats, logs or profile.
create table if not exists public.partner_links (
  id               bigint generated always as identity primary key,
  owner_id         uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  invite_code      text not null unique check (length(invite_code) >= 10),
  partner_id       uuid unique references auth.users(id) on delete cascade,
  partner_name     text,
  notify_heads_up  boolean not null default true,
  notify_tips      boolean not null default true,
  notify_crisis    boolean not null default true,
  created_at       timestamptz default now(),
  accepted_at      timestamptz
);
alter table public.partner_links enable row level security;

drop policy if exists "owner manages link" on public.partner_links;
create policy "owner manages link" on public.partner_links
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "partner sees link" on public.partner_links;
create policy "partner sees link" on public.partner_links
  for select to authenticated using (partner_id = auth.uid());
drop policy if exists "partner can leave" on public.partner_links;
create policy "partner can leave" on public.partner_links
  for delete to authenticated using (partner_id = auth.uid());

-- She can create an invite and switch nudges on/off. Nobody can write partner_id directly:
-- that only happens through accept_partner_invite below.
revoke all on public.partner_links from anon, authenticated;
grant select, delete on public.partner_links to authenticated;
grant insert (invite_code) on public.partner_links to authenticated;
grant update (notify_heads_up, notify_tips, notify_crisis) on public.partner_links to authenticated;
grant select, insert, update, delete on public.partner_links to service_role;

-- The partner opens the invite link, signs in, and this connects them.
create or replace function public.accept_partner_invite(code text, display_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  link public.partner_links;
  her  text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into link from public.partner_links where invite_code = code for update;
  if not found then raise exception 'invite_not_found'; end if;
  if link.owner_id = auth.uid() then raise exception 'own_invite'; end if;
  if link.partner_id is not null and link.partner_id <> auth.uid() then raise exception 'invite_used'; end if;
  if link.partner_id is null and link.created_at < now() - interval '7 days' then raise exception 'invite_expired'; end if;
  if exists (select 1 from public.partner_links where partner_id = auth.uid() and id <> link.id) then
    raise exception 'already_partner';
  end if;
  update public.partner_links
     set partner_id = auth.uid(),
         partner_name = left(nullif(trim(display_name), ''), 40),
         accepted_at = coalesce(accepted_at, now())
   where id = link.id;
  select split_part(coalesce(nullif(trim(name), ''), 'your partner'), ' ', 1) into her
    from public.profiles where id = link.owner_id;
  return coalesce(her, 'your partner');
end $$;
revoke all on function public.accept_partner_invite(text, text) from public, anon;
grant execute on function public.accept_partner_invite(text, text) to authenticated;

-- ================= Milestone 4: Life-stage modes (safe to re-run) =================
alter table public.profiles add column if not exists due_date date;   -- pregnancy mode
alter table public.profiles add column if not exists ttc_since date;  -- trying-to-conceive mode

-- Hot flushes and night sweats get their own log kinds, so Hera can count them.
alter table public.cycle_logs drop constraint if exists cycle_logs_kind_check;
alter table public.cycle_logs add constraint cycle_logs_kind_check check (kind in
  ('period_start','period_end','flow','pain','mood','energy','symptom','sleep','sex_drive','note','hot_flash','night_sweat'));

-- ================= Podcasts, themes, partner calendar (safe to re-run) =================
alter table public.profiles add column if not exists podcast_picks boolean default true;  -- a podcast every 3 days
alter table public.profiles add column if not exists theme text default 'plum';           -- colour theme
-- She decides whether her partner sees her next likely period dates.
alter table public.partner_links add column if not exists share_dates boolean not null default true;
grant update (notify_heads_up, notify_tips, notify_crisis, share_dates) on public.partner_links to authenticated;

-- ================= Beta: feedback and bug list (safe to re-run) =================
-- "Something wrong?" reports from the app. Read them in Supabase → Table Editor → feedback.
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category    text not null check (category in ('wrong_info','wrong_log','tone','bug','idea','other')),
  hera_reply  text,          -- the reply she flagged, if any
  note        text,
  status      text not null default 'new' check (status in ('new','fixing','fixed','wont_fix')),
  created_at  timestamptz default now()
);
alter table public.feedback enable row level security;
drop policy if exists "own feedback" on public.feedback;
create policy "own feedback" on public.feedback
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (category, hera_reply, note) on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;
