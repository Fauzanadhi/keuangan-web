# Rekap Keuangan (Next.js + Supabase)

Web rekap keuangan pribadi berdasarkan `Keuangan_pribadi.xlsx`.

## Fitur
- Login (email + kata sandi), data tiap user terisolasi lewat Row Level Security
- Catat pemasukan/pengeluaran, hapus transaksi, cari berdasarkan catatan
- Saldo otomatis, rekap per bulan, grafik tren dan komposisi pengeluaran
- Anggaran per kategori untuk bulan dan tahun tertentu, dilengkapi diagram pengeluaran dan anggaran
- Halaman Dompet dengan saldo per dompet
- Catat transaksi dengan saldo per dompet dan sisa anggaran kategori
- Wish List untuk menyimpan target barang, menandai barang selesai, serta melihat riwayat pembelian

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
- `migrasi_pindah_dana_investasi.sql` adalah migrasi historis untuk database lama. Fitur Pindah Dana dan jenis dompet Investasi tidak lagi tersedia di aplikasi; data transfer dan dompet lama tetap dipertahankan untuk menjaga saldo historis.
- Jalankan `migrasi_kategori_dompet_arsip.sql` sekali setelah migrasi anggaran dan pindah dana untuk mengelola kategori pengeluaran dan mengarsipkan dompet sambil menjaga riwayat.
- Untuk project yang sudah ada, jalankan `migrasi_kategori_pemasukan.sql` setelah migrasi di atas agar kategori pemasukan dapat dikelola dan disimpan per pengguna.
- Jika project sudah memakai skema sebelumnya, jalankan `migrasi_anggaran_bulanan_wishlist.sql` sekali di Supabase SQL Editor. Migrasi menyalin anggaran bulanan lama ke bulan berjalan; seluruh data lama tetap di tabel `budgets`, sedangkan anggaran harian, mingguan, dan tahunan tidak disalin karena tidak memiliki padanan langsung pada model baru.
- Setelah migrasi Wish List bulanan di atas, jalankan `migrasi_wishlist_selesai.sql` untuk mengaktifkan riwayat penyelesaian dan kaitan Wish List pada transaksi pengeluaran.
- **Anggaran:** buka pintasan Anggaran di Beranda, pilih kategori, bulan, dan tahun, lalu atur batasnya. Diagram membandingkan anggaran dan pengeluaran pada bulan/tahun yang dipilih.
- **Catat transaksi:** gunakan pintasan Beranda untuk membuka formulir transaksi dan ringkasan saldo per dompet. Pengeluaran menampilkan sisa anggaran untuk kategori dan bulan transaksi.
- **Kategori:** menu Kategori digunakan untuk menambah atau menghapus kategori pemasukan dan pengeluaran. Kategori Investasi adalah kategori pengeluaran biasa dan dapat dihapus.
- **Dompet:** pintasan Dompet membuka saldo serta rincian semua dompet dalam satu daftar. Dompet dapat dihapus dari daftar aktif dengan mengarsipkannya; riwayatnya tetap ada dan menandai dompet yang telah dihapus.
- **Wish List:** simpan target barang, tandai selesai secara manual, atau pilih Wish List opsional saat mencatat pengeluaran. Pengeluaran terkait otomatis menyelesaikan Wish List dan mencatat nominal transaksi sebagai harga pembelian; barang selesai tetap terlihat di riwayat.
- **Ubah transaksi:** tombol "Ubah" di daftar transaksi. Gunakan ini untuk mengisi dompet pada data lama. Transfer lama tetap tercatat dan memengaruhi saldo dompet, tetapi hanya dapat dilihat atau dihapus.
- Data hasil import Excel masuk ke "Tanpa dompet".
- **Akun:** ubah kata sandi dari menu akun; kata sandi saat ini diminta untuk verifikasi.
- **PWA:** harus lewat HTTPS, jadi deploy dulu (Vercel), lalu buka di Chrome HP dan pilih "Tambahkan ke layar utama".

## Akun dan login username
- Jalankan `migrasi_akun_username.sql` sekali di Supabase SQL Editor.
- Tambahkan `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Settings > API Keys > Legacy > service_role) ke `.env.local` dan ke Vercel. Kunci ini rahasia dan hanya dipakai server (`app/api/login`), jangan diberi awalan `NEXT_PUBLIC_`.
- Halaman pendaftaran ada di `/daftar`. Login menerima username, atau email.

## Lupa kata sandi
Di halaman masuk klik "Lupa kata sandi?" (`/lupa`), isi username atau email, lalu buka tautan di email untuk membuat kata sandi baru. Tidak perlu migrasi SQL tambahan.
