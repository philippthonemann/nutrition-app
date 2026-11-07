begin;
alter table public.meals add column edit_version integer not null default 0 check (edit_version >= 0);
alter table public.meals add column edit_note text check (length(edit_note) <= 500);
commit;
