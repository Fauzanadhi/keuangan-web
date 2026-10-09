-- Jalankan sekali setelah migrasi_anggaran_bulanan_wishlist.sql di Supabase SQL Editor.

alter table public.wish_list
  add column if not exists completed_at timestamptz,
  add column if not exists completed_amount bigint;

alter table public.transactions
  add column if not exists wishlist_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wish_list_completed_amount_check'
      and conrelid = 'public.wish_list'::regclass
  ) then
    alter table public.wish_list
      add constraint wish_list_completed_amount_check
      check (completed_amount is null or completed_amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transaction_wishlist_expense_only'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transaction_wishlist_expense_only
      check (wishlist_id is null or type = 'out');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_wishlist_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_wishlist_id_fkey
      foreign key (wishlist_id) references public.wish_list(id) on delete set null;
  end if;
end $$;

create index if not exists transactions_wishlist_id_idx
  on public.transactions (wishlist_id);

create or replace function public.complete_linked_wishlist_transaction()
returns trigger
language plpgsql
as $$
begin
  if new.wishlist_id is not null then
    if not exists (
      select 1 from public.wish_list
      where id = new.wishlist_id and user_id = new.user_id
    ) then
      raise exception 'Wish List tidak ditemukan untuk pengguna ini.';
    end if;

    update public.wish_list
    set completed_at = now(), completed_amount = new.amount
    where id = new.wishlist_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_complete_linked_wishlist on public.transactions;
create trigger transactions_complete_linked_wishlist
after insert or update of wishlist_id, amount, type on public.transactions
for each row
execute function public.complete_linked_wishlist_transaction();
