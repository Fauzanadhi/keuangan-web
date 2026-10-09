-- Jalankan sekali setelah migrasi_fitur_baru.sql untuk mendukung pindah dana
-- antar dompet aktif.

alter table public.transactions
  add column if not exists wallet_to_id uuid references public.wallets(id);

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('in', 'out', 'transfer'));

alter table public.transactions
  drop constraint if exists transactions_transfer_wallets_check;

alter table public.transactions
  add constraint transactions_transfer_wallets_check
  check (type <> 'transfer' or (wallet_id is not null and wallet_to_id is not null and wallet_id <> wallet_to_id));
