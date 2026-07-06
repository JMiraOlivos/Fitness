-- Adds a warmup flag to set_logs so warmup sets can be logged without contaminating
-- volume, estimated 1RM, or average-RPE calculations (which today can't tell a warmup
-- set from a working set). Defaults to false so existing rows keep counting as they
-- always have.

alter table public.set_logs
  add column if not exists is_warmup boolean not null default false;
