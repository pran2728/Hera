-- Hera's reminder schedule: paste into Supabase → SQL Editor → Run, AFTER database.sql.
-- Every 15 minutes, Supabase asks the hera-nudge function whether anyone is due a reminder.
-- Needs the pg_cron and pg_net extensions (Database → Extensions). Safe to re-run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'hera-nudges';

select cron.schedule(
  'hera-nudges',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://duzhnjnmkkrzodiowlml.supabase.co/functions/v1/hera-nudge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select value from public.hera_settings where key = 'cron_secret')
      ),
      body := '{"action":"run"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- Check it's there:
select jobname, schedule, active from cron.job where jobname = 'hera-nudges';
