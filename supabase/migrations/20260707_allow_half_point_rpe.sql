-- Allows half-point RPE (7.5, 8.5, ...) instead of only whole numbers 1-10, so a set
-- logged as "a little harder than an 8 but not quite a 9" doesn't have to round either
-- way. rpe stays nullable; the check now restricts it to 1-10 in 0.5 increments.

alter table public.set_logs
  drop constraint if exists set_logs_rpe_check;

alter table public.set_logs
  alter column rpe type numeric(3,1) using rpe::numeric(3,1);

alter table public.set_logs
  add constraint set_logs_rpe_check check (
    rpe is null or (rpe >= 1 and rpe <= 10 and (rpe * 2) = trunc(rpe * 2))
  );
