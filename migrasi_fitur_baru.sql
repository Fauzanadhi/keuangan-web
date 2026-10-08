-- Jalankan SEKALI di Supabase SQL Editor (untuk edit transaksi sudah tidak perlu SQL; ini untuk dompet & transaksi berulang)

create table public.wallets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null default 'cash' check (kind in ('cash', 'emoney', 'bank')),
  created_at timestamptz default now()
);

alter table public.transactions
  add column wallet_id uuid references public.wallets(id) on delete set null;

create table public.recurring (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users(id) on delete cascade,
  type       text not null check (type in ('in', 'out')),
  amount     bigint not null check (amount > 0),
  category   text not null,
  note       text default '',
  wallet_id  uuid references public.wallets(id) on delete set null,
  frequency  text not null check (frequency in ('weekly', 'monthly')),
  next_date  date not null,
  created_at timestamptz default now()
);

alter table public.wallets enable row level security;
alter table public.recurring enable row level security;

create policy "dompet milik sendiri" on public.wallets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "berulang milik sendiri" on public.recurring
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
