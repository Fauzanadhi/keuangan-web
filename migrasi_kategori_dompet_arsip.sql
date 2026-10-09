-- Jalankan sekali setelah migrasi_anggaran_bulanan_wishlist.sql dan
-- migrasi_pindah_dana_investasi.sql.

create table if not exists public.expense_categories (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.expense_categories enable row level security;
drop policy if exists "kategori pengeluaran milik sendiri" on public.expense_categories;
create policy "kategori pengeluaran milik sendiri" on public.expense_categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.expense_categories (user_id, category)
select users.id, categories.category
from auth.users as users
cross join (values
  ('Jajan'),
  ('Jalan'),
  ('Kebutuhan'),
  ('Tanggungan'),
  ('Infaq'),
  ('Tabungan'),
  ('Investasi'),
  ('Lainnya')
) as categories(category)
on conflict (user_id, category) do nothing;

alter table public.wallets
  add column if not exists archived_at timestamptz;
