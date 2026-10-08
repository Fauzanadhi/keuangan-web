-- Jalankan di Supabase: SQL Editor > New query > Run

create table public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users(id) on delete cascade,
  date       date not null,
  type       text not null check (type in ('in', 'out')),   -- in = pemasukan, out = pengeluaran
  amount     bigint not null check (amount > 0),
  category   text not null,
  note       text default '',
  created_at timestamptz default now()
);

create table public.budgets (
  user_id  uuid default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  amount   bigint not null check (amount >= 0),
  kind     text not null default 'limit' check (kind in ('limit', 'target')), -- limit = batas pengeluaran, target = target menabung
  primary key (user_id, category)
);

create index on public.transactions (user_id, date desc);

-- Keamanan: tiap user hanya bisa melihat dan mengubah datanya sendiri
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy "transaksi milik sendiri" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budget milik sendiri" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
