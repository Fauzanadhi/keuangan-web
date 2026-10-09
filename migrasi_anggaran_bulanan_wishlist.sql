-- Jalankan sekali di Supabase SQL Editor untuk model anggaran per kategori/bulan
-- dan fitur Wish List.

create table if not exists public.category_budgets (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  amount   bigint not null check (amount >= 0),
  kind     text not null default 'limit' check (kind in ('limit', 'target')),
  month    smallint not null check (month between 1 and 12),
  year     integer not null check (year between 2000 and 2100),
  primary key (user_id, category, month, year)
);

alter table public.category_budgets enable row level security;
drop policy if exists "budget milik sendiri" on public.category_budgets;
create policy "budget milik sendiri" on public.category_budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.wish_list (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  target_amount bigint not null check (target_amount > 0),
  created_at    timestamptz not null default now()
);

alter table public.wish_list enable row level security;
drop policy if exists "wishlist milik sendiri" on public.wish_list;
create policy "wishlist milik sendiri" on public.wish_list
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Anggaran bulanan lama disalin ke bulan berjalan; data lama tetap tersimpan
-- di tabel budgets sebagai arsip. Anggaran harian/mingguan/tahunan tidak
-- memiliki padanan langsung pada model baru sehingga tidak disalin.
do $$
begin
  if to_regclass('public.budgets') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public' and table_name = 'budgets' and column_name = 'period'
     ) then
    execute $sql$
      insert into public.category_budgets (user_id, category, amount, kind, month, year)
      select user_id, category, amount, kind, extract(month from current_date)::smallint, extract(year from current_date)::integer
      from public.budgets
      where period = 'monthly' and user_id is not null
      on conflict (user_id, category, month, year) do nothing
    $sql$;
  elsif to_regclass('public.budgets') is not null then
    execute $sql$
      insert into public.category_budgets (user_id, category, amount, kind, month, year)
      select user_id, category, amount, kind, extract(month from current_date)::smallint, extract(year from current_date)::integer
      from public.budgets
      where user_id is not null
      on conflict (user_id, category, month, year) do nothing
    $sql$;
  end if;
end
$$;
