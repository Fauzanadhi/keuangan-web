-- Jalankan sekali setelah migrasi_kategori_dompet_arsip.sql di Supabase SQL Editor.

create table if not exists public.income_categories (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.income_categories enable row level security;
drop policy if exists "kategori pemasukan milik sendiri" on public.income_categories;
create policy "kategori pemasukan milik sendiri" on public.income_categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.income_categories (user_id, category)
select users.id, categories.category
from auth.users as users
cross join (values
  ('Deposit'),
  ('Gaji'),
  ('Lainnya')
) as categories(category)
on conflict (user_id, category) do nothing;
