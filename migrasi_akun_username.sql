-- Jalankan SEKALI di Supabase SQL Editor (kosongkan kotaknya dulu). Aman dijalankan ulang.
-- Username boleh huruf besar/kecil, angka, spasi, dan garis bawah (_), 3-20 karakter.

create table if not exists public.profiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email    text not null
);

-- Aturan baru (menggantikan aturan lama kalau tabelnya sudah ada)
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles drop constraint if exists profiles_username_key;
alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[A-Za-z0-9_]+( [A-Za-z0-9_]+)*$' and length(username) between 3 and 20);

-- Kolom bantu untuk pencarian dan keunikan tanpa membedakan huruf besar/kecil
alter table public.profiles add column if not exists username_lower text generated always as (lower(username)) stored;
create unique index if not exists profiles_username_lower_key on public.profiles (username_lower);

alter table public.profiles enable row level security;
drop policy if exists "profil sendiri" on public.profiles;
create policy "profil sendiri" on public.profiles for select using (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username, email)
  values (new.id, trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))), new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Akun yang sudah ada: username diambil dari bagian email sebelum @
insert into public.profiles (user_id, username, email)
select id, u, email from (
  select id, email, regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '', 'g') as u from auth.users
) x
where length(u) between 3 and 20
on conflict do nothing;

-- Username akun kamu
update public.profiles set username = 'Fauzan Adhi' where email = 'fauzanadhiw@gmail.com';
