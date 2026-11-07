-- Run only after verifying auth.users contains the intended invited owner.
-- No user UUID or email is embedded in source control.
begin;
lock table public.meals, public.body_measurements, public.goals in access exclusive mode;

create temporary table nutrition_before on commit drop as
select 'meals'::text as name, count(*) as rows,
       md5(string_agg(to_jsonb(t)::text, '' order by id)) as fingerprint from public.meals t
union all
select 'body_measurements', count(*), md5(string_agg(to_jsonb(t)::text, '' order by id)) from public.body_measurements t
union all
select 'goals', count(*), md5(string_agg(to_jsonb(t)::text, '' order by id)) from public.goals t;

do $$
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Expected exactly one verified-by-operator owner account';
  end if;
  if not exists (select 1 from auth.users where email is not null and not is_anonymous and invited_at is not null) then
    raise exception 'Expected the explicitly invited owner account';
  end if;
end $$;

create table public.app_owner (
  user_id uuid primary key references auth.users(id) on delete restrict,
  singleton boolean not null default true unique check (singleton)
);
insert into public.app_owner(user_id) select id from auth.users;
alter table public.app_owner enable row level security;
alter table public.app_owner force row level security;
revoke all on public.app_owner from public, anon, authenticated;
grant select on public.app_owner to authenticated;
create policy owner_membership on public.app_owner for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare
  target text;
  owner_id uuid := (select user_id from public.app_owner);
  rule record;
begin
  foreach target in array array['meals', 'body_measurements', 'goals'] loop
    execute format('alter table public.%I add column user_id uuid references public.app_owner(user_id) on delete restrict', target);
    execute format('update public.%I set user_id = $1', target) using owner_id;
    execute format('alter table public.%I alter column user_id set default auth.uid(), alter column user_id set not null', target);
    execute format('create index %I on public.%I(user_id)', target || '_user_id_idx', target);
    execute format('alter table public.%I enable row level security', target);
    execute format('alter table public.%I force row level security', target);
    for rule in select policyname from pg_policies where schemaname = 'public' and tablename = target loop
      execute format('drop policy %I on public.%I', rule.policyname, target);
    end loop;
    execute format('revoke all on public.%I from public, anon, authenticated', target);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target);
    execute format('create policy private_owner_access on public.%I for all to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.app_owner o where o.user_id = (select auth.uid()))) with check (user_id = (select auth.uid()) and exists (select 1 from public.app_owner o where o.user_id = (select auth.uid())))', target);
  end loop;
end $$;

-- Abort the whole transaction if any pre-existing content changed.
do $$
declare
  old record;
  new_count bigint;
  new_fingerprint text;
begin
  for old in select * from nutrition_before loop
    execute format('select count(*), md5(string_agg((to_jsonb(t) - ''user_id'')::text, '''' order by id)) from public.%I t', old.name)
      into new_count, new_fingerprint;
    if old.rows <> new_count or old.fingerprint is distinct from new_fingerprint then
      raise exception 'Content preservation failed for %', old.name;
    end if;
  end loop;
end $$;
commit;
