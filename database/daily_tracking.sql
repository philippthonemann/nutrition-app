begin;
create table public.daily_tracking (
  user_id uuid not null default auth.uid() references public.app_owner(user_id) on delete restrict,
  date date not null,
  completion text not null default 'auto' check (completion in ('auto','complete','incomplete')),
  calorie_goal integer not null check (calorie_goal > 0),
  primary key (user_id, date)
);
alter table public.daily_tracking enable row level security;
alter table public.daily_tracking force row level security;
revoke all on public.daily_tracking from public, anon, authenticated;
grant select, insert, update, delete on public.daily_tracking to authenticated;
create policy daily_tracking_owner on public.daily_tracking for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
comment on column public.body_measurements.hip is 'Legacy API field: Oberarmumfang in cm, not hip circumference. Existing values retained.';
commit;
