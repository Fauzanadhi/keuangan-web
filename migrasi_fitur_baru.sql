-- Jalankan SEKALI di Supabase SQL Editor (untuk edit transaksi sudah tidak perlu SQL; ini untuk dompet)

create table public.wallets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null default 'cash' check (kind in ('cash', 'emoney', 'bank')),
  created_at timestamptz default now()
);

alter table public.transactions
  add column wallet_id uuid references public.wallets(id) on delete set null;

alter table public.wallets enable row level security;

create policy "dompet milik sendiri" on public.wallets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
