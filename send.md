# Ringkasan Akses Akun & Alur WMS

## 1. Daftar Akun dan Level Akses
Sistem WMS memiliki 3 tingkatan (role) pengguna:

1. **foreman1** (Role 1 - Foreman / Checker)
   - Level operasional lapangan.
   - Digunakan untuk eksekusi langsung seperti input Inbound barang datang, proses relokasi/putaway fisik, melakukan picking outbond, dan penginputan data Stock Opname aktual di rak.

2. **admin1** (Role 2 - Admin Gudang)
   - Level supervisor atau manajemen menengah.
   - Memiliki akses lebih luas untuk memonitor laporan perpindahan barang (log stok), mengawasi opname, manajemen data master produk, dan pemantauan akurasi stok secara keseluruhan.

3. **superadmin** (Role 3 - Super Admin)
   - Level tertinggi (Pemilik/Manajer IT).
   - Memiliki kendali penuh terhadap seluruh sistem konfigurasi, manajemen akun pengguna, pengaturan master lokasi gudang, dan seluruh fitur laporan esensial.

---

## 2. Alur Utama Sistem WMS (Warehouse Management System)
Secara garis besar, pergerakan barang dalam sistem ini adalah sebagai berikut:

- **INBOUND (Barang Masuk)**
  Berfungsi untuk mencatat kedatangan barang dari pihak supplier. Pengguna memasukkan referensi No.PO, memilih item dari master, menentukan zone dan nomor rak tujuan, lalu memasukkan *batch number*, *expiry date*, dan *quantity*. Data yang disubmit akan langsung masuk ke tabel persediaan barang di gudang asal tersebut. Terdapat validasi ketat yang melarang penempatan dua barang berbeda pada rak yang sama.

- **PUTAWAY / RELOCATION (Perpindahan Internal)**
  Alur untuk memindahkan (atau memecah jumlah) stok dari rak asal ke lokasi rak tujuan baru. Berguna untuk merapihkan area lantai atau mentransfer ke area *Reject*. Sistem akan otomatis memvalidasi apakah rak tujuan kosong atau berisi barang yang seragam sebelum perpindahan disetujui, demi menghindari tercampurnya produk.

- **OUTBOUND / PICKING (Barang Keluar)**
  Proses pengambilan persediaan untuk didistribusikan / dikirim. Pengguna menargetkan nomor rak spesifik, lalu menginput kuantitas yang akan dikeluarkan dengan merujuk pada nomor referensi pengeluaran. Kuantitas pada rak terpilih akan dipotong (deducted). Stok kosong otomatis terhapus dari *display inventory*.

- **STOCK OPNAME (Penyesuaian Fisik Berkala)**
  Sistem untuk memverifikasi kecocokan data komputer dan wujud fisik di lapangan. Pengguna memilih rak dan memasukkan angka aktual terkini. Sistem akan langsung menimpa angka di komputer dengan angka baru, lalu memperhitungkan *variance* (surplus/defisit). Perhitungan juga mendistribusikan beban minus/plus secara adil tanpa menambah stok secara tumpang tindih jika terdapat multidata di rak yang sama.

---

## 3. Fitur Spesifik (Aging, Accuracy, dll)
- **Aging Material (Masa Tahan Simpan)**
  Sistem akan melacak seberapa lama barang telah berada di gudang sejak pertama kali direkam (berdasarkan tanggal masuk/dibuat *created_at*). Jika jumlah hari mencapai lebih dari 90 hari, indikator visual akan memeringkatkan barang tersebut berstatus "AGING", bertujuan untuk segera memprioritaskan penjualannya.

- **Near Expired / Expired (Tanggal Kadaluarsa)**
  Sistem menghitung selisih hari ini terhadap *expiry_date* produk. Tanggal yang terlewat ditandai "EXPIRED" secara sistem dan dikalkulasi rentang harinya ke belakang. Jika masih berlaku tetapi sisa usianya di bawah batas aman spesifik (kurang dari 30 hari), status bergeser menjadi peringatan darurat "NEAR EXPIRED". (Catatan: Status ini akan menimpa/menggantikan level peringatan dari sistem Aging biasa karena urgensi kelayakannya).

- **Universal Accuracy (Akurasi Universal)**
  Berbeda dengan akurasi sempit per-rak, akurasi universal menghitung keseluruhan *stok aktual* suatu produk (misal Item "Biang Ayam") secara melintang di *seluruh lokasi gudang dan rak* dikomparasikan dengan total persediaan *di sistem/komputer*. Sehingga *blind spot* perbedaan fisik akibat salah simpan rak dapat diakumulasi dengan akurat ke persentasi nilai riil barang tersebut.
