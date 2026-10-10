-- Hera admin numbers: for you only. Paste into Supabase → SQL Editor → Run (safe to re-run).
-- Then open Table Editor, switch the schema dropdown (top left) from "public" to "admin",
-- and click any view. They update live; nothing here is reachable from the app.
--
-- Privacy: these views show WHO uses Hera and HOW MUCH, never what anyone said or logged.

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- 1. Every account, one row each.
create or replace view admin.users as
with
  msg as (select user_id, count(*) filter (where role = 'user') as messages_sent, max(created_at) filter (where role = 'user') as last_message
          from public.messages group by user_id),
  lg  as (select user_id, count(*) as logs, max(created_at) as last_log,
                 count(*) filter (where kind = 'period_start') as periods_logged from public.cycle_logs group by user_id),
  push as (select user_id, count(*) as devices from public.push_subscriptions group by user_id),
  fb  as (select user_id, count(*) as feedback from public.feedback group by user_id)
select
  u.email,
  u.created_at::date                                   as signed_up,
  (u.email_confirmed_at is not null)                   as email_confirmed,
  case when pl_p.partner_id is not null and p.onboarded_at is null then 'partner'
       when p.onboarded_at is not null then 'user' else 'not finished setup' end as account_type,
  p.name,
  p.life_stage,
  p.theme,
  coalesce(msg.messages_sent, 0)                       as messages_sent,
  coalesce(lg.logs, 0)                                 as logs,
  coalesce(lg.periods_logged, 0)                       as periods_logged,
  (coalesce(push.devices, 0) > 0)                      as notifications_on,
  case when pl.partner_id is not null then 'connected'
       when pl.id is not null then 'invited, waiting' else 'no' end as partner,
  pu.email                                             as partner_email,
  coalesce(fb.feedback, 0)                             as feedback_sent,
  greatest(u.last_sign_in_at, msg.last_message, lg.last_log) as last_active
from auth.users u
left join public.profiles p        on p.id = u.id
left join msg                      on msg.user_id = u.id
left join lg                       on lg.user_id = u.id
left join push                     on push.user_id = u.id
left join fb                       on fb.user_id = u.id
left join public.partner_links pl  on pl.owner_id = u.id
left join auth.users pu            on pu.id = pl.partner_id
left join public.partner_links pl_p on pl_p.partner_id = u.id
order by u.created_at desc;

-- 2. The headline numbers, one row per metric.
create or replace view admin.kpis as
with
  u as (select * from admin.users),
  active as (select distinct user_id, created_at::date as d from public.messages where role = 'user'
             union select distinct user_id, created_at::date from public.cycle_logs),
  women as (select count(*) as n from u where account_type = 'user')
select * from (values
  (1,  'Sign-ups (all accounts)',            (select count(*) from u)::text),
  (2,  'Sign-ups in the last 7 days',        (select count(*) from u where signed_up > current_date - 7)::text),
  (3,  'Finished setup (women)',             (select n from women)::text),
  (4,  'Setup completion rate',              (select case when count(*) filter (where account_type <> 'partner') = 0 then '-' else
                                                round(100.0 * count(*) filter (where account_type = 'user') / count(*) filter (where account_type <> 'partner'))::text || '%' end from u)),
  (5,  'Active today',                       (select count(distinct user_id) from active where d = current_date)::text),
  (6,  'Active in the last 7 days',          (select count(distinct user_id) from active where d > current_date - 7)::text),
  (7,  'Came back on 2+ different days',     (select count(*) from (select user_id from active group by user_id having count(distinct d) >= 2) x)::text),
  (8,  'Messages sent to Hera',              (select count(*) from public.messages where role = 'user')::text),
  (9,  'Messages per active user (7 days)',  (select coalesce(round(count(*)::numeric / nullif(count(distinct user_id), 0), 1), 0)::text
                                                from public.messages where role = 'user' and created_at > now() - interval '7 days')),
  (10, 'Things logged (periods, moods…)',    (select count(*) from public.cycle_logs)::text),
  (11, 'Women who logged a period',          (select count(*) from u where account_type = 'user' and periods_logged > 0)::text),
  (12, 'Notifications turned on',            (select count(*) from u where notifications_on)::text || ' of ' || (select count(*) from u)::text),
  (13, 'Partner invites created',            (select count(*) from public.partner_links)::text),
  (14, 'Partners connected',                 (select count(*) from public.partner_links where partner_id is not null)::text),
  (15, 'Invite acceptance rate',             (select case when count(*) = 0 then '-' else round(100.0 * count(partner_id) / count(*))::text || '%' end from public.partner_links)),
  (16, 'Reminders sent (last 7 days)',       (select count(*) from public.nudges_sent where sent_at > now() - interval '7 days')::text),
  (17, 'Partner crisis alerts (all time)',   (select count(*) from public.nudges_sent where kind = 'partner_crisis')::text),
  (18, 'Feedback reports (new / total)',     (select count(*) filter (where status = 'new')::text || ' / ' || count(*)::text from public.feedback))
) as k(n, metric, value)
order by n;

-- 3. Activity per day (last 30 days): new sign-ups, active users, messages, logs.
create or replace view admin.daily as
select d::date as day,
  (select count(*) from auth.users where created_at::date = d)                                              as sign_ups,
  (select count(distinct user_id) from (select user_id from public.messages where role = 'user' and created_at::date = d
                                        union select user_id from public.cycle_logs where created_at::date = d) a) as active_users,
  (select count(*) from public.messages where role = 'user' and created_at::date = d)                      as messages,
  (select count(*) from public.cycle_logs where created_at::date = d)                                       as logs
from generate_series(current_date - 29, current_date, interval '1 day') d
order by day desc;

-- 4. What people choose (counts only).
create or replace view admin.preferences as
select 'Life stage' as setting, coalesce(life_stage, '-') as choice, count(*) as women from public.profiles where onboarded_at is not null group by life_stage
union all select 'Colour theme', coalesce(theme, 'plum'), count(*) from public.profiles where onboarded_at is not null group by theme
union all select 'Tone', coalesce(tone, '-'), count(*) from public.profiles where onboarded_at is not null group by tone
union all select 'Diet', coalesce(diet, '-'), count(*) from public.profiles where onboarded_at is not null group by diet
union all select 'Podcast picks', case when podcast_picks is false then 'off' else 'on' end, count(*) from public.profiles where onboarded_at is not null group by 1, 2
union all select 'Daily tips', case when daily_tips then 'on' else 'off' end, count(*) from public.profiles where onboarded_at is not null group by 1, 2
union all select 'Logged with', case when kind in ('period_start','period_end') then 'period dates' else kind end, count(*) from public.cycle_logs group by 1, 2
union all select 'Reminder type sent', kind, count(*) from public.nudges_sent group by kind
order by 1, 3 desc;

-- 5. The bug list, newest first (with who sent it, so you can follow up).
create or replace view admin.feedback as
select f.created_at, u.email, f.category, f.status, f.note, left(f.hera_reply, 200) as hera_reply
from public.feedback f join auth.users u on u.id = f.user_id
order by f.created_at desc;

revoke all on all tables in schema admin from public, anon, authenticated;
