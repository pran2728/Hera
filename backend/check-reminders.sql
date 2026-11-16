-- Why aren't reminders arriving? Paste into Supabase → SQL Editor → Run.
-- Read-only: it changes nothing. Shows one row per check.

select 'Schedule exists and is on' as check_name,
       coalesce((select string_agg(jobname || ' · active: ' || active, ', ') from cron.job where jobname = 'hera-nudges'),
                'MISSING: run backend/schedule.sql') as result
union all
select 'Last 5 schedule runs (IST)',
       coalesce((select string_agg(to_char(start_time at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') || ' ' || status
                                   || coalesce(' · ' || left(return_message, 60), ''), ' | ' order by start_time desc)
                 from (select * from cron.job_run_details
                       where jobid in (select jobid from cron.job where jobname = 'hera-nudges')
                       order by start_time desc limit 5) r), 'no runs recorded')
union all
select 'Last 5 replies from hera-nudge',
       coalesce((select string_agg(to_char(created at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') || ' · '
                                   || coalesce(status_code::text, 'no reply') || case when timed_out then ' · TIMED OUT' else '' end
                                   || coalesce(' · ' || left(error_msg, 60), '') || coalesce(' · ' || left(content::text, 90), ''), ' | ' order by created desc)
                 from (select * from net._http_response order by created desc limit 5) h), 'no replies recorded')
union all
select 'Phones with notifications on',
       (select count(*) || ' phones, ' || count(distinct user_id) || ' people · newest added '
               || coalesce(to_char(max(created_at) at time zone 'Asia/Kolkata', 'DD Mon'), 'never')
        from public.push_subscriptions)
union all
select 'Reminders sent, last 10 days',
       coalesce((select string_agg(d || ': ' || n, ', ' order by d desc)
                 from (select to_char(for_date, 'DD Mon') d, for_date, count(*) n from public.nudges_sent
                       where for_date > current_date - 10 group by for_date) s), 'NONE in the last 10 days')
union all
select 'Last reminder ever sent',
       coalesce((select to_char(max(sent_at) at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') from public.nudges_sent), 'never');
