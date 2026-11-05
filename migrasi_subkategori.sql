-- Jalankan sekali di Supabase SQL Editor untuk mengaktifkan subkategori pengeluaran.

alter table public.transactions
  add column if not exists subcategory text;

create table if not exists public.expense_subcategories (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  subcategory text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category, subcategory),
  constraint expense_subcategories_category_fkey
    foreign key (user_id, category)
    references public.expense_categories(user_id, category)
    on update cascade
    on delete cascade
);

alter table public.expense_subcategories enable row level security;

drop policy if exists "subkategori pengeluaran milik sendiri" on public.expense_subcategories;
create policy "subkategori pengeluaran milik sendiri"
  on public.expense_subcategories
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists transactions_user_subcategory_date_idx
  on public.transactions (user_id, subcategory, date desc)
  where type = 'out';
