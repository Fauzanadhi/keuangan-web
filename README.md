# Rekap Keuangan (Next.js + Supabase)

Web rekap keuangan pribadi berdasarkan `Keuangan_pribadi.xlsx`.

## Fitur
- Login (email + kata sandi), data tiap user terisolasi lewat Row Level Security
- Catat pemasukan/pengeluaran, pindah dana antar dompet, hapus transaksi, cari berdasarkan catatan
- Saldo otomatis, rekap per bulan, grafik tren dan komposisi pengeluaran
- Anggaran per kategori untuk bulan dan tahun tertentu, dilengkapi diagram pengeluaran dan anggaran
- Halaman Dompet dengan saldo investasi dari dompet bertipe Investasi
- Catat transaksi dengan saldo per dompet dan sisa anggaran kategori
- Wish List untuk menyimpan nama barang dan harga target

## Cara menjalankan
1. Buat project di https://supabase.com, lalu buka **SQL Editor**, tempel isi `schema.sql`, dan Run.
2. Salin `.env.example` menjadi `.env.local`, isi URL dan anon key dari **Project Settings > API**.
3. `npm install` lalu `npm run dev`, buka http://localhost:3000, dan buat akun.
4. (Opsional) Untuk matikan konfirmasi email saat uji coba: **Authentication > Providers > Email**.

## Import data dari Excel
`data/transaksi_import.csv` berisi 419 transaksi dari sheet Rekap Harian (Okt 2025 sampai Jun 2026), sudah dipisah satu baris per transaksi.
1. Supabase **Table Editor > transactions > Insert > Import data from CSV**, pilih file tersebut.
2. Karena import lewat dashboard tidak membawa user, jalankan di SQL Editor (ganti UUID dengan id user kamu dari **Authentication > Users**):
   ```sql
   update public.transactions set user_id = 'UUID-USER-KAMU' where user_id is null;
   ```

## Deploy
Push ke GitHub, import ke Vercel, isi dua environment variable yang sama dengan `.env.local`.

## Fitur tambahan (dompet, anggaran, PWA)
- Jalankan `migrasi_fitur_baru.sql` sekali di Supabase SQL Editor (setelah `schema.sql`) untuk menambahkan dompet.
- Jalankan `migrasi_pindah_dana_investasi.sql` sekali setelah `migrasi_fitur_baru.sql` untuk menambahkan dukungan Pindah Dana dan dompet bertipe Investasi.
- Jalankan `migrasi_kategori_dompet_arsip.sql` sekali setelah migrasi anggaran dan pindah dana untuk mengelola kategori pengeluaran dan mengarsipkan dompet sambil menjaga riwayat.
- Jika project sudah memakai skema sebelumnya, jalankan `migrasi_anggaran_bulanan_wishlist.sql` sekali di Supabase SQL Editor. Migrasi menyalin anggaran bulanan lama ke bulan berjalan; seluruh data lama tetap di tabel `budgets`, sedangkan anggaran harian, mingguan, dan tahunan tidak disalin karena tidak memiliki padanan langsung pada model baru.
- **Anggaran:** buka pintasan Anggaran di Beranda, pilih kategori, bulan, dan tahun, lalu atur batasnya. Diagram membandingkan anggaran dan pengeluaran pada bulan/tahun yang dipilih.
- **Catat transaksi:** gunakan pintasan Beranda untuk membuka formulir transaksi dan ringkasan saldo per dompet. Pengeluaran menampilkan sisa anggaran untuk kategori dan bulan transaksi.
- **Pindah dana:** catat perpindahan antara dua dompet; saldo asal berkurang dan saldo tujuan bertambah. Pindah dana masuk ke dompet Investasi otomatis tercatat sebagai pengeluaran kategori Investasi dan masuk ke anggarannya; pencairan dari Investasi ke dompet biasa dihitung sebagai pemasukan. Pindah antar dompet biasa tidak mengubah total pemasukan/pengeluaran.
- **Kategori pengeluaran:** pada laman Anggaran, tambahkan/hapus kategori yang tersedia pada transaksi dan anggaran. Kategori Investasi disediakan otomatis untuk Pindah Dana dan tidak bisa dihapus. Pengeluaran biasa berkategori Investasi yang tercatat lama tidak dihitung ke anggaran Investasi.
- **Saldo Investasi:** tambah dompet dengan jenis Investasi, lalu gunakan Pindah Dana untuk memasukkan atau mencairkan dana. Nilai saldo semua dompet Investasi ditampilkan terpisah dari saldo dompet biasa di Beranda dan halaman Dompet.
- **Dompet:** pintasan Dompet membuka saldo serta rincian dompet biasa dan investasi dalam daftar terpisah. Dompet dapat dihapus dari daftar aktif dengan mengarsipkannya; riwayatnya tetap ada dan menandai dompet yang telah dihapus.
- **Wish List:** simpan nama barang dan harga target dari pintasan Beranda.
- **Ubah transaksi:** tombol "Ubah" di daftar transaksi. Gunakan ini untuk mengisi dompet pada data lama.
- Data hasil import Excel masuk ke "Tanpa dompet".
- **Pengaturan:** ubah kata sandi akun dari menu Pengaturan.
- **PWA:** harus lewat HTTPS, jadi deploy dulu (Vercel), lalu buka di Chrome HP dan pilih "Tambahkan ke layar utama".

## Akun dan login username
- Jalankan `migrasi_akun_username.sql` sekali di Supabase SQL Editor.
- Tambahkan `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Settings > API Keys > Legacy > service_role) ke `.env.local` dan ke Vercel. Kunci ini rahasia dan hanya dipakai server (`app/api/login`), jangan diberi awalan `NEXT_PUBLIC_`.
- Halaman pendaftaran ada di `/daftar`. Login menerima username, atau email.

## Lupa kata sandi
Di halaman masuk klik "Lupa kata sandi?" (`/lupa`), isi username atau email, lalu buka tautan di email untuk membuat kata sandi baru. Tidak perlu migrasi SQL tambahan.
