begin;
create table public.user_profile (
  user_id uuid primary key default auth.uid() references public.app_owner(user_id) on delete restrict,
  avatar_data_url text check (avatar_data_url is null or (length(avatar_data_url) <= 100000 and avatar_data_url ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'))
);
alter table public.user_profile enable row level security;
alter table public.user_profile force row level security;
revoke all on public.user_profile from public,anon,authenticated;
grant select,insert,update,delete on public.user_profile to authenticated;
create policy user_profile_owner on public.user_profile for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
commit;
