-- Additive schema; food data and existing access rules are preserved.
create table public.shopping_lists (
 id uuid primary key,
 user_id uuid not null default auth.uid() references public.app_owner(user_id),
 document jsonb not null default '{"name":"Einkauf","retailer":"REWE","categories":[],"items":[],"archived":false}',
 updated_at timestamptz not null default now(),
 unique(user_id,id),
 check(jsonb_typeof(document)='object' and jsonb_typeof(document->'items')='array' and length(document->>'name') between 1 and 100)
);
create index shopping_lists_owner on public.shopping_lists(user_id);
create table public.shopping_operations (
 user_id uuid not null default auth.uid() references public.app_owner(user_id),
 operation_id uuid not null,
 list_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id),
 foreign key(user_id,list_id) references public.shopping_lists(user_id,id) on delete cascade
);
create index shopping_operations_list on public.shopping_operations(user_id,list_id);
create table public.shopping_price_cache (
 user_id uuid not null default auth.uid() references public.app_owner(user_id),
 query_key text not null check(length(query_key) between 1 and 300),
 status text not null check(status in ('pending','found','missing','error')),
 result jsonb,
 checked_at timestamptz not null default now(),
 primary key(user_id,query_key)
);
alter table public.shopping_lists enable row level security;
alter table public.shopping_operations enable row level security;
alter table public.shopping_price_cache enable row level security;
create policy owner_access on public.shopping_lists for all to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.app_owner where user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.app_owner where user_id=(select auth.uid())));
create policy owner_access on public.shopping_operations for all to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.app_owner where user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.app_owner where user_id=(select auth.uid())));
create policy owner_access on public.shopping_price_cache for all to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.app_owner where user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.app_owner where user_id=(select auth.uid())));
revoke all on public.shopping_lists,public.shopping_operations,public.shopping_price_cache from anon;
grant select,insert,update,delete on public.shopping_lists,public.shopping_operations,public.shopping_price_cache to authenticated;
-- Serialized, idempotent actions keep offline retries and concurrent tabs from duplicating additions.
create function public.shopping_mutate(p_list_id uuid,p_operation_id uuid,p_action jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d jsonb; entry jsonb; incoming jsonb; items jsonb; result_items jsonb; matched boolean; patch jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized'; end if;
 if octet_length(p_action::text)>200000 then raise exception 'Action too large'; end if;
 if p_action->>'type'='create' then
  insert into public.shopping_lists(id,user_id,document) values(p_list_id,auth.uid(),jsonb_build_object('name',p_action->>'name','retailer','REWE','categories',p_action->'categories','items','[]'::jsonb,'archived',false)) on conflict(id) do nothing;
 end if;
 select document into d from public.shopping_lists where id=p_list_id and user_id=auth.uid() for update;
 if d is null then raise exception 'List unavailable'; end if;
 if exists(select 1 from public.shopping_operations where user_id=auth.uid() and operation_id=p_operation_id) then return d; end if;
 if p_action->>'type'='meta' then
  patch=p_action->'patch';
  if exists(select 1 from jsonb_object_keys(patch) k where k not in ('name','retailer','categories','archived')) then raise exception 'Invalid fields'; end if;
  d=d||patch;
 elsif p_action->>'type'='add' then
  items=d->'items';
  for incoming in select value from jsonb_array_elements(p_action->'items') loop
   if not ((incoming->>'quantity')::numeric>0 and (incoming->>'quantity')::numeric<=10000000) or incoming->>'unit' not in ('g','ml','piece') or length(incoming->>'name') not between 1 and 160 or incoming->>'merge_key' is null then raise exception 'Invalid item'; end if;
   perform (incoming->>'id')::uuid;
   matched=false; result_items='[]'::jsonb;
   for entry in select value from jsonb_array_elements(items) loop
    if not matched and not coalesce((entry->>'removed')::boolean,false) and not coalesce((entry->>'checked')::boolean,false) and entry->>'merge_key'=incoming->>'merge_key' then
     entry=jsonb_set(entry,'{quantity}',to_jsonb((entry->>'quantity')::numeric+(incoming->>'quantity')::numeric));
     entry=jsonb_set(entry,'{alias_ids}',coalesce(entry->'alias_ids','[]'::jsonb)||jsonb_build_array(incoming->>'id')); matched=true;
    end if;
    result_items=result_items||jsonb_build_array(entry);
   end loop;
   if not matched then result_items=result_items||jsonb_build_array(incoming||'{"checked":false,"removed":false}'::jsonb); end if;
   items=result_items;
  end loop;
  d=jsonb_set(d,'{items}',items);
 elsif p_action->>'type'='item' then
  patch=p_action->'patch';
  if exists(select 1 from jsonb_object_keys(patch) k where k not in ('quantity','checked','removed','category')) then raise exception 'Invalid fields'; end if;
  if patch ? 'quantity' and not ((patch->>'quantity')::numeric>0 and (patch->>'quantity')::numeric<=10000000) then raise exception 'Invalid quantity'; end if;
  select coalesce(jsonb_agg(case when value->>'id'=p_action->>'id' or coalesce(value->'alias_ids','[]'::jsonb) ? (p_action->>'id') then value||patch else value end),'[]'::jsonb) into items from jsonb_array_elements(d->'items');
  d=jsonb_set(d,'{items}',items);
 elsif p_action->>'type'<>'create' then raise exception 'Invalid action';
 end if;
 if length(d->>'retailer')>80 or jsonb_typeof(d->'categories')<>'array' or jsonb_array_length(d->'items')>2000 then raise exception 'List too large'; end if;
 update public.shopping_lists set document=d,updated_at=now() where id=p_list_id and user_id=auth.uid();
 insert into public.shopping_operations(user_id,operation_id,list_id) values(auth.uid(),p_operation_id,p_list_id);
 return d;
end $$;
revoke all on function public.shopping_mutate(uuid,uuid,jsonb) from public,anon;
grant execute on function public.shopping_mutate(uuid,uuid,jsonb) to authenticated;
