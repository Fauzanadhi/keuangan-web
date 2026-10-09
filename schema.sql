-- Jalankan di Supabase: SQL Editor > New query > Run

create table public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users(id) on delete cascade,
  date       date not null,
  type       text not null check (type in ('in', 'out')),
  amount     bigint not null check (amount > 0),
  category   text not null,
  note       text default '',
  wishlist_id uuid,
  constraint transaction_wishlist_expense_only check (wishlist_id is null or type = 'out'),
  created_at timestamptz default now()
);

create table public.category_budgets (
  user_id  uuid default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  amount   bigint not null check (amount >= 0),
  kind     text not null default 'limit' check (kind in ('limit', 'target')), -- limit = batas pengeluaran, target = target menabung
  month    smallint not null check (month between 1 and 12),
  year     integer not null check (year between 2000 and 2100),
  primary key (user_id, category, month, year)
);

create table public.expense_categories (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.income_categories (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.wish_list (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  target_amount bigint not null check (target_amount > 0),
  completed_at  timestamptz,
  completed_amount bigint check (completed_amount is null or completed_amount > 0),
  created_at    timestamptz not null default now()
);

alter table public.transactions
  add constraint transactions_wishlist_id_fkey
  foreign key (wishlist_id) references public.wish_list(id) on delete set null;

create index transactions_wishlist_id_idx on public.transactions (wishlist_id);

create function public.complete_linked_wishlist_transaction()
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

create trigger transactions_complete_linked_wishlist
after insert or update of wishlist_id, amount, type on public.transactions
for each row
execute function public.complete_linked_wishlist_transaction();

create index on public.transactions (user_id, date desc);

-- Keamanan: tiap user hanya bisa melihat dan mengubah datanya sendiri
alter table public.transactions enable row level security;
alter table public.category_budgets enable row level security;
alter table public.expense_categories enable row level security;
alter table public.income_categories enable row level security;
alter table public.wish_list enable row level security;

create policy "transaksi milik sendiri" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budget milik sendiri" on public.category_budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "kategori pengeluaran milik sendiri" on public.expense_categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "kategori pemasukan milik sendiri" on public.income_categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wishlist milik sendiri" on public.wish_list
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
