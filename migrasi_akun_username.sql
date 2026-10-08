-- Jalankan SEKALI di Supabase SQL Editor (kosongkan kotaknya dulu)

create table if not exists public.profiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  email    text not null
);

alter table public.profiles enable row level security;
drop policy if exists "profil sendiri" on public.profiles;
create policy "profil sendiri" on public.profiles for select using (user_id = auth.uid());

-- Setiap akun baru otomatis dibuatkan profil dari username yang diisi saat daftar
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username, email)
  values (new.id, lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))), new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Akun yang sudah ada: username diambil dari bagian email sebelum @
insert into public.profiles (user_id, username, email)
select id, u, email from (
  select id, email, lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')) as u from auth.users
) x
where length(u) between 3 and 20
on conflict do nothing;

-- Ingin mengganti username akun lama? Ubah lalu jalankan baris ini (hapus tanda -- di depannya):
-- update public.profiles set username = 'fauzan' where email = 'EMAIL-KAMU@gmail.com';
