/**
 * SISTEM INVENTORY BARANG + KODE RESTO + OTDR - VERSI FIX
 *
 * Fitur:
 * - Barang masuk
 * - Tanggal expired otomatis dari DATABASE_BARANG kolom Umur Expired (Bulan)
 * - Rak bisa menampung banyak batch/lot; barang masuk boleh beberapa batch dalam satu rak
 * - Barang keluar FEFO
 * - Role Quality Control untuk monitoring FIFO/FEFO stock, prioritas expired, dan lot yang harus keluar dulu
 * - Barang keluar memakai validasi pra-eksekusi dan rollback: jika gagal, stok/OTDR/mutasi/BARANG_KELUAR tidak berubah
 * - Barang keluar bisa multiple output/item dalam satu transaksi
 * - Admin bisa membuat Picking List berdasarkan PO dengan rekomendasi FEFO per lot/batch
 * - Admin bisa edit qty Barang Keluar saat ada ketidaksesuaian; STOCK_ONHAND, OTDR, mutasi, dan log audit ikut terkoreksi
 * - PO diganti menjadi Kode Resto dari DATABASE_RESTO
 * - Jika Kode Resto double, dropdown menampilkan beberapa pilihan berdasarkan nopol/sopir
 * - Search Kode Resto pada menu Barang Keluar agar pilihan resto cepat ditemukan
 * - Search lokasi/rak, nomor batch, dan tanggal produksi pada kolom lokasi/batch agar pencarian lot lebih cepat
 * - Notice koordinator saat data barang masuk/keluar berpotensi double/bertumbukan sebelum disimpan
 * - Koordinator IN bisa melihat keterangan rak kosong terakhir dikeluarkan tanggal berapa dari transaksi barang keluar
 * - Konfirmasi/alert Simpan Semua Output berisi tujuan resto, tanggal dimuat, nama item, dan qty
 * - Menu OTDR untuk melengkapi start muat, selesai muat, nama-nama yang muat, nopol, WA sopir
 * - Mutasi IN/OUT/PINDAH_LOKASI
 * - Export mutasi CSV
 * - Report stock filter/group
 * - Jam In otomatis real-time saat barang masuk
 * - Form Barang Masuk memiliki input Waktu Masuk CS format menit:detik untuk time motion proses masuk CS
 * - User Inventory khusus update lokasi rak dan status GOOD/HOLD
 * - Menu Supervisor Time Motion Study untuk mengukur durasi barang masuk dan barang keluar
 * - Alert barang masuk menampilkan Tanggal BSTB
 * - Cetak form Stock Opname untuk Inventory dan Supervisor dengan Qty Actual, Selisih, dan status Sesuai/Tidak Sesuai
 * - Nama user transaksi/PIC input tercatat pada barang masuk, barang keluar, mutasi, OTDR, update lokasi, stock report, dan form stock opname
 * - Menu Okupansi Gudang untuk melihat % okupansi RELEASE, HOLD, dan TOTAL berdasarkan kapasitas rak DEDICATED saja; rak FLOOR/GANGWAY tidak dihitung kapasitas
 * - Menu QC FIFO dapat update status lot khusus HOLD ↔ RELEASE tanpa akses pindah lokasi rak
 * - Koordinator IN dan OUT dapat akses menu Mutasi Barang serta Scan QR/Barcode Rak untuk monitoring operasional
 * - Menu Report menampilkan total inbound/outbound per range tanggal seperti tabel summary, plus detail per hari dan qty setiap item
 * - Menu Supervisor Import Stock Awal dari template spreadsheet/CSV dengan validasi relasi DATABASE_BARANG, DATABASE_STATUS, dan DATABASE_RAK
 * - Dropdown template import memakai Daftar dari Rentang agar aman untuk master data lebih dari 500 item
 * - Login ADMIN khusus untuk input nomor IT Terima dan IT Kirim dalam bentuk tabel di sheet ADMIN_IT
 * - Admin IT dapat mencari transaksi barang masuk/keluar berdasarkan tanggal lalu mengisi nomor IT langsung ke database transaksi terkait
 * - Tombol WA pada tabel OTDR untuk mengirim link dashboard sopir otomatis
 * - Dashboard sopir untuk upload evidence/foto bukti barang diterima, checker, dan status sesuai/tidak sesuai
 * - Jika dashboard sopir menyatakan barang diterima dan sesuai, Status OTDR otomatis menjadi COMPLETE dan link bukti tersimpan di tabel OTDR
 *
 * PATCH LOGIN BUTTON NO RESPONSE + BACKEND ROUTING: inline frontend JS sudah valid, tombol login memakai binding aman, dan DATABASE_USER bootstrap ringan.
 *
 * Cara pakai:
 * 1. Hapus script lama di Code.gs.
 * 2. Tempel seluruh script ini.
 * 3. Save.
 * 4. Jalankan setupInventorySystem().
 * 5. Reload spreadsheet.
 */

const CONFIG = {
  timezone: 'Asia/Jakarta',
  // Opsional: isi ID spreadsheet bila script dipasang sebagai standalone web app.
  // Jika script bound ke spreadsheet, boleh dikosongkan.
  spreadsheetId: '',
  sheets: {
    barangMasuk: 'BARANG_MASUK',
    stock: 'STOCK_ONHAND',
    barangKeluar: 'BARANG_KELUAR',
    mutasiBarang: 'MUTASI_BARANG',
    otdr: 'OTDR',
    otdrEvidence: 'OTDR_BUKTI_TERIMA',
    logLokasi: 'LOG_UPDATE_LOKASI',
    dbBarang: 'DATABASE_BARANG',
    dbStatus: 'DATABASE_STATUS',
    dbKoordinator: 'DATABASE_KOORDINATOR',
    dbRak: 'DATABASE_RAK',
    dbResto: 'DATABASE_RESTO',
    dbUser: 'DATABASE_USER',
    stockImportTemplate: 'STOCK_IMPORT_TEMPLATE',
    stockImportLog: 'LOG_IMPORT_STOCK',
    noticeTransaksi: 'LOG_NOTICE_TRANSAKSI',
    adminIt: 'ADMIN_IT',
    relasiRakBatch: 'RELASI_RAK_BATCH',
    pickingList: 'PICKING_LIST',
    logEditBarangKeluar: 'LOG_EDIT_BARANG_KELUAR'
  },
  headers: {
    barangMasuk: [
      'Timestamp Input', 'Tanggal Bukti Serah Terima Barang', 'Tanggal Produksi', 'Tanggal Expired',
      'Nama Barang', 'Total Qty', 'Satuan', 'Status', 'Shift In / Koordinator',
      'Nomor Bukti Serah Terima Barang', 'Lokasi Rak', 'Nomor IT Kirim', 'Keterangan', 'Jam In', 'Nama User Transaksi',
      'Nomor IT Terima', 'Tanggal Update IT Terima', 'Admin Update IT Terima', 'Nomor Batch',
      'Waktu Masuk CS (Menit)'
    ],
    stock: [
      'ID Stock', 'Nama Barang', 'Tanggal Produksi', 'Tanggal Expired', 'Status', 'Lokasi Rak',
      'Qty Masuk', 'Qty Keluar', 'Stock Onhand', 'Satuan',
      'Nomor Bukti Serah Terima Barang', 'Tanggal Bukti Serah Terima Barang',
      'Nomor IT Kirim Terakhir', 'Last Update', 'Key Lot', 'Nama User Input Terakhir',
      'Nomor IT Terima Terakhir', 'Last Update IT Terima', 'Admin IT Terima', 'Nomor Batch'
    ],
    barangKeluar: [
      'Timestamp Input', 'Tanggal Dimuat', 'Kode Resto', 'Nama Resto', 'Nopol', 'WA Sopir', 'Nama Sopir',
      'Nama Barang', 'Qty Keluar', 'Satuan', 'Shift Out / Koordinator',
      'Nomor Surat Jalan', 'Nomor IT Kirim', 'Lokasi Rak', 'ID Stock',
      'Nomor Bukti Serah Terima Barang', 'Tanggal Expired', 'ID OTDR', 'Keterangan', 'Nama User Transaksi',
      'Tanggal Update IT Kirim', 'Admin Update IT Kirim', 'Nomor Batch',
      'Nomor PO', 'ID Picking', 'Row Picking List', 'Status Relasi Picking'
    ],
    mutasiBarang: [
      'Timestamp Input', 'Jenis Mutasi', 'Tanggal Transaksi', 'Nama Barang', 'Tanggal Produksi', 'Tanggal Expired',
      'Status', 'Lokasi Rak', 'Qty Masuk', 'Qty Keluar', 'Saldo Akhir Lot', 'Satuan',
      'ID Stock', 'Nomor BSTB', 'Nomor IT Kirim', 'Kode Resto', 'Nama Resto', 'Nomor Surat Jalan',
      'Shift / Koordinator', 'Keterangan', 'Nama User Transaksi',
      'Nomor IT Terima', 'Timestamp Update IT', 'Admin Update IT', 'Nomor Batch'
    ],
    otdr: [
      'Timestamp Create', 'Timestamp Update', 'ID OTDR', 'Tanggal Dimuat', 'Kode Resto', 'Nama Resto',
      'Nomor Surat Jalan', 'Nomor IT Kirim', 'Nopol', 'WA Sopir', 'Nama Sopir',
      'Start Muat', 'Selesai Muat', 'Nama-Nama Yang Muat', 'Status OTDR',
      'Total Item Output', 'Total Qty Output', 'Catatan', 'Nama User Create', 'Nama User Update',
      'Link Dashboard Sopir', 'Token Dashboard Sopir', 'Status Terima Sopir', 'Tanggal Terima Sopir',
      'Nama Penerima', 'Nama Checker', 'Status Checker', 'Link Bukti Foto', 'Catatan Bukti Terima', 'ID File Bukti'
    ],
    otdrEvidence: [
      'Timestamp Submit', 'ID OTDR', 'Tanggal Dimuat', 'Kode Resto', 'Nama Resto', 'Nomor Surat Jalan',
      'Nopol', 'WA Sopir', 'Nama Sopir', 'Status Terima Sopir', 'Nama Penerima', 'Nama Checker',
      'Status Checker', 'Link Bukti Foto', 'Catatan Bukti Terima', 'ID File Bukti', 'User Agent / Sumber'
    ],
    logLokasi: [
      'Timestamp Update', 'ID Stock', 'Nama Barang', 'Lokasi Lama', 'Lokasi Baru',
      'Status Lama', 'Status Baru', 'PIC / Koordinator', 'Keterangan', 'Nama User Update'
    ],
    dbBarang: ['Nama Barang', 'Satuan Default', 'Status Default', 'Lokasi Rak Default', 'Umur Expired (Bulan)'],
    dbStatus: ['Status'],
    dbKoordinator: ['Nama Koordinator', 'Shift'],
    dbRak: ['Lokasi Rak', 'Kapasitas Rak', 'Jenis Rak'],
    dbResto: ['Kode Resto', 'Nama Resto', 'Nopol', 'WA Sopir', 'Nama Sopir', 'Keterangan'],
    dbUser: ['Username', 'Password', 'Nama User', 'Role', 'Akses Barang Masuk', 'Akses Barang Keluar', 'Akses OTDR', 'Akses Lokasi', 'Akses Supervisor', 'Status'],
    stockImportTemplate: [
      'Aksi', 'Tanggal Bukti Serah Terima Barang', 'Tanggal Produksi', 'Tanggal Expired (Opsional)',
      'Nama Barang', 'Qty Stock Awal', 'Satuan (Opsional)', 'Status', 'Lokasi Rak',
      'Nomor Bukti Serah Terima Barang', 'Nomor IT Kirim', 'Shift / Koordinator', 'Keterangan',
      'Hasil Validasi', 'Waktu Import', 'ID Stock Hasil'
    ],
    stockImportLog: [
      'Timestamp Import', 'ID Import', 'Baris Template', 'Nama Barang', 'Tanggal Produksi', 'Tanggal Expired',
      'Status', 'Lokasi Rak', 'Qty Import', 'Satuan', 'Nomor BSTB', 'Nomor IT Kirim',
      'Shift / Koordinator', 'ID Stock', 'Status Import', 'Pesan', 'Nama User Import'
    ],
    noticeTransaksi: [
      'Timestamp Notice', 'Jenis Transaksi', 'Level Notice', 'Key Data', 'Pesan Notice',
      'User / Koordinator', 'Status Tindakan'
    ],
    adminIt: [
      'Timestamp Input', 'Tanggal IT', 'Jenis IT', 'Nomor IT Terima', 'Nomor IT Kirim',
      'Nomor Referensi Dokumen', 'Kode Resto / Supplier', 'Nama Barang / Keterangan Item',
      'Qty', 'Catatan Admin', 'Nama Admin Input', 'Sumber Relasi', 'Row Transaksi', 'Status Relasi'
    ],
    relasiRakBatch: [
      'Timestamp Sync', 'ID Stock', 'Key Lot', 'Lokasi Rak', 'Nomor Batch', 'Nama Barang',
      'Tanggal Produksi', 'Tanggal Expired', 'Status', 'Stock Onhand', 'Satuan',
      'Nomor BSTB', 'Tanggal BSTB', 'Last Update Stock', 'Nama User Input Terakhir'
    ],
    pickingList: [
      'Timestamp Buat', 'Nomor PO', 'Tanggal Muat', 'Kode Resto', 'Nama Resto', 'Nopol', 'Nama Sopir',
      'Nomor Surat Jalan', 'Nama Barang', 'Qty PO', 'Qty Pick', 'Satuan', 'Lokasi Rak', 'ID Stock',
      'Nomor Batch', 'Tanggal Produksi', 'Tanggal Expired', 'Status Stock', 'Nomor BSTB',
      'Status Picking', 'Catatan', 'Dibuat Oleh',
      'ID Picking', 'ID OTDR', 'Row Barang Keluar', 'Timestamp Barang Keluar', 'User Barang Keluar'
    ],
    logEditBarangKeluar: [
      'Timestamp Edit', 'Row Barang Keluar', 'Tanggal Dimuat', 'Kode Resto', 'Nama Resto',
      'Nomor Surat Jalan', 'ID OTDR', 'Nama Barang', 'ID Stock', 'Nomor Batch', 'Lokasi Rak',
      'Qty Lama', 'Qty Baru', 'Selisih Qty', 'Stock Onhand Setelah Edit',
      'Alasan / Catatan', 'Diedit Oleh'
    ]
  }
};


/**
 * Helper koneksi spreadsheet database.
 * - Script bound spreadsheet: otomatis memakai spreadsheet aktif.
 * - Script standalone/web app: isi CONFIG.spreadsheetId atau jalankan setInventorySpreadsheetId('ID_SPREADSHEET').
 */
function getInventorySpreadsheet_() {
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {}
  if (ss) return ss;

  let spreadsheetId = '';
  try { spreadsheetId = clean_(CONFIG.spreadsheetId || ''); } catch (err) { spreadsheetId = ''; }
  if (!spreadsheetId) {
    try { spreadsheetId = clean_(PropertiesService.getScriptProperties().getProperty('INVENTORY_SPREADSHEET_ID') || ''); } catch (err) {}
  }
  if (!spreadsheetId) {
    try { spreadsheetId = clean_(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ''); } catch (err) {}
  }
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  throw new Error('Backend belum terhubung ke spreadsheet database. Jika script ini bukan bound script, jalankan setInventorySpreadsheetId("ID_SPREADSHEET") sekali dari Apps Script, atau isi CONFIG.spreadsheetId.');
}

function setInventorySpreadsheetId(spreadsheetId) {
  spreadsheetId = clean_(spreadsheetId);
  if (!spreadsheetId) throw new Error('ID spreadsheet wajib diisi.');
  PropertiesService.getScriptProperties().setProperty('INVENTORY_SPREADSHEET_ID', spreadsheetId);
  const ss = SpreadsheetApp.openById(spreadsheetId);
  return { ok: true, spreadsheetId: spreadsheetId, name: ss.getName(), url: ss.getUrl() };
}

function getInventorySpreadsheetInfo() {
  const ss = getInventorySpreadsheet_();
  return { ok: true, id: ss.getId(), name: ss.getName(), url: ss.getUrl() };
}

function safeToast_(message, title, seconds) {
  try {
    getInventorySpreadsheet_().toast(message, title || 'Info', seconds || 5);
  } catch (err) {}
}

function ensureLoginSystemReady_() {
  const ss = getInventorySpreadsheet_();
  const userSheet = getOrCreateSheet_(ss, CONFIG.sheets.dbUser);
  syncSheetStructureByHeader_(userSheet, CONFIG.headers.dbUser);
  repairDatabaseUserRows_(userSheet);
  getDefaultUserRows_().forEach(function(userRow) {
    ensureDefaultUser_(userSheet, userRow);
  });
  return { ok: true, userSheet: CONFIG.sheets.dbUser, totalUsers: Math.max(userSheet.getLastRow() - 1, 0) };
}

function repairLoginAndBackendRouting() {
  const result = { ok: true, login: null, fullSetup: null, spreadsheet: null, warnings: [] };
  result.spreadsheet = getInventorySpreadsheetInfo();
  result.login = ensureLoginSystemReady_();
  try {
    ensureSystemReady_();
    result.fullSetup = { ok: true, message: 'Relasi semua sheet berhasil diperbaiki.' };
  } catch (err) {
    result.fullSetup = { ok: false, message: err && err.message ? err.message : String(err) };
    result.warnings.push(result.fullSetup.message);
  }
  return result;
}

function pingBackend() {
  const ss = getInventorySpreadsheet_();
  const login = ensureLoginSystemReady_();
  return {
    ok: true,
    message: 'Backend aktif dan DATABASE_USER siap dipakai untuk login.',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    totalUsers: login.totalUsers,
    serverTime: Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss')
  };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventory Barang')
    .addItem('Buka Aplikasi Inventory', 'showInventoryApp')
    .addItem('Setup / Perbaiki Sheet', 'setupInventorySystem')
    .addSeparator()
    .addItem('Rapikan Tampilan Sheet', 'formatAllSheets')
    .addItem('Buat Ulang Histori Mutasi', 'rebuildMutasiFromExistingData')
    .addToUi();
}

function doGet(e) {
  // Routing halaman tidak boleh menjalankan setup penuh karena bisa membuat login gagal/timeout.
  // Cukup siapkan DATABASE_USER; repair relasi transaksi dilakukan setelah login atau dari menu setup.
  try { safeEnsureSystemReadyForLogin_(); } catch (loginErr) {}

  const params = (e && e.parameter) ? e.parameter : {};
  const page = clean_(params.page || params.p || '').toLowerCase();
  const token = clean_(params.token || params.driver || params.t || '');
  if (page === 'sopir' || token) {
    return HtmlService.createHtmlOutput(getDriverDashboardHtml_(token))
      .setTitle('Dashboard Bukti Terima Sopir')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutput(getInventoryHtml())
    .setTitle('Aplikasi Inventory Barang')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  return doGet(e);
}

function showInventoryApp() {
  const html = HtmlService.createHtmlOutput(getInventoryHtml())
    .setTitle('Aplikasi Inventory Barang')
    .setWidth(560);
  SpreadsheetApp.getUi().showSidebar(html);
}

function setupInventorySystem() {
  ensureSystemReady_();
  formatAllSheets();
  safeToast_('Setup selesai. Relasi sheet, login, import, dan LOG_NOTICE_TRANSAKSI sudah disiapkan.', 'Sukses', 8);
}

function ensureSystemReady_() {
  const ss = getInventorySpreadsheet_();
  Object.keys(CONFIG.sheets).forEach(function(key) {
    const sheet = getOrCreateSheet_(ss, CONFIG.sheets[key]);
    setHeaders_(sheet, CONFIG.headers[key]);
  });
  repairSheetRelations_();
  validateConfiguredHeaders_();
  seedDatabase_();
  // Jangan sampai dashboard/login gagal hanya karena sheet relasi batch belum bisa disinkron.
  // Data utama tetap dibaca langsung dari STOCK_ONHAND, sedangkan RELASI_RAK_BATCH adalah index bantu.
  safeSyncRelasiRakBatch_();
}

function safeSyncRelasiRakBatch_() {
  try {
    return { ok: true, rows: syncRelasiRakBatch_(), message: '' };
  } catch (err) {
    return { ok: false, rows: 0, message: err && err.message ? err.message : String(err) };
  }
}

function safeEnsureSystemReadyForLogin_() {
  // Login tidak boleh menjalankan setup penuh semua sheet.
  // Penyebab login gagal sebelumnya: repair header transaksi/picking/OTDR ikut dieksekusi saat halaman dibuka.
  try {
    const result = ensureLoginSystemReady_();
    return { ok: true, warning: '', result: result };
  } catch (repairErr) {
    throw new Error('Login gagal karena DATABASE_USER/backend spreadsheet tidak bisa disiapkan. Detail: ' + (repairErr && repairErr.message ? repairErr.message : repairErr));
  }
}

function formatAllSheets() {
  const ss = getInventorySpreadsheet_();
  Object.keys(CONFIG.sheets).forEach(function(key) {
    const sheet = ss.getSheetByName(CONFIG.sheets[key]);
    if (!sheet) return;
    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) return;
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, lastColumn)
      .setFontWeight('bold')
      .setBackground('#1f4e78')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.autoResizeColumns(1, lastColumn);
  });
}

function seedDatabase_() {
  const ss = getInventorySpreadsheet_();

  const statusSheet = ss.getSheetByName(CONFIG.sheets.dbStatus);
  if (statusSheet.getLastRow() < 2) {
    statusSheet.getRange(2, 1, 6, 1).setValues([
      ['GOOD'], ['HOLD'], ['REJECT'], ['RELEASE'], ['EXPIRED'], ['DAMAGED']
    ]);
  }

  const koorSheet = ss.getSheetByName(CONFIG.sheets.dbKoordinator);
  if (koorSheet.getLastRow() < 2) {
    koorSheet.getRange(2, 1, 6, 2).setValues([
      ['Koordinator In 1', 'Shift 1'],
      ['Koordinator In 2', 'Shift 2'],
      ['Koordinator In 3', 'Shift 3'],
      ['Koordinator Out 1', 'Shift 1'],
      ['Koordinator Out 2', 'Shift 2'],
      ['Koordinator Out 3', 'Shift 3']
    ]);
  }

  const rakSheet = ss.getSheetByName(CONFIG.sheets.dbRak);
  if (rakSheet.getLastRow() < 2) {
    rakSheet.getRange(2, 1, 7, 3).setValues([
      ['R-A1', 100, 'DEDICATED'],
      ['R-A2', 100, 'DEDICATED'],
      ['R-B1', 100, 'DEDICATED'],
      ['R-B2', 100, 'DEDICATED'],
      ['R-C1', 100, 'DEDICATED'],
      ['GANGWAY-1', 0, 'FLOOR'],
      ['T-AREA-1', 0, 'FLOOR']
    ]);
  }

  const barangSheet = ss.getSheetByName(CONFIG.sheets.dbBarang);
  if (barangSheet.getLastRow() < 2) {
    barangSheet.getRange(2, 1, 3, 5).setValues([
      ['Contoh Barang 1', 'Carton', 'GOOD', 'RAK-A1', 6],
      ['Contoh Barang 2', 'Pack', 'GOOD', 'RAK-A2', 12],
      ['Contoh Barang 3', 'Carton', 'HOLD', 'AREA-HOLD', 3]
    ]);
  }

  const restoSheet = ss.getSheetByName(CONFIG.sheets.dbResto);
  if (restoSheet.getLastRow() < 2) {
    restoSheet.getRange(2, 1, 4, 6).setValues([
      ['R001', 'Resto A', 'B 1234 ABC', '6281211111111', 'Sopir A', 'Contoh data resto'],
      ['R002', 'Resto B', 'B 5678 DEF', '6281222222222', 'Sopir B', 'Contoh data resto'],
      ['R001', 'Resto A Cabang 2', 'B 7777 GHI', '6281233333333', 'Sopir C', 'Contoh double kode resto'],
      ['R003', 'Resto C', 'B 9999 JKL', '6281244444444', 'Sopir D', 'Contoh data resto']
    ]);
  }

  const userSheet = ss.getSheetByName(CONFIG.sheets.dbUser);
  repairDatabaseUserRows_(userSheet);
  const defaultUsers = getDefaultUserRows_();
  if (userSheet.getLastRow() < 2) {
    userSheet.getRange(2, 1, defaultUsers.length, CONFIG.headers.dbUser.length).setValues(defaultUsers);
  }

  // FIX LOGIN: walaupun DATABASE_USER lama sudah berisi data, pastikan akun dasar tetap tersedia.
  // Ini mencegah login gagal karena sheet user pernah dibuat tetapi akun in/out/spv/admin belum lengkap.
  defaultUsers.forEach(function(userRow) {
    ensureDefaultUser_(userSheet, userRow);
  });
}

function getDefaultUserRows_() {
  return [
    ['in1', 'in123', 'Koordinator In 1', 'KOORDINATOR_IN', 'YA', 'TIDAK', 'TIDAK', 'TIDAK', 'TIDAK', 'AKTIF'],
    ['in2', 'in123', 'Koordinator In 2', 'KOORDINATOR_IN', 'YA', 'TIDAK', 'TIDAK', 'TIDAK', 'TIDAK', 'AKTIF'],
    ['in3', 'in123', 'Koordinator In 3', 'KOORDINATOR_IN', 'YA', 'TIDAK', 'TIDAK', 'TIDAK', 'TIDAK', 'AKTIF'],
    ['out1', 'out123', 'Koordinator Out 1', 'KOORDINATOR_OUT', 'TIDAK', 'YA', 'YA', 'TIDAK', 'TIDAK', 'AKTIF'],
    ['out2', 'out123', 'Koordinator Out 2', 'KOORDINATOR_OUT', 'TIDAK', 'YA', 'YA', 'TIDAK', 'TIDAK', 'AKTIF'],
    ['out3', 'out123', 'Koordinator Out 3', 'KOORDINATOR_OUT', 'TIDAK', 'YA', 'YA', 'TIDAK', 'TIDAK', 'AKTIF'],
    ['inv1', 'inv123', 'Inventory 1', 'INVENTORY', 'TIDAK', 'TIDAK', 'TIDAK', 'YA', 'TIDAK', 'AKTIF'],
    ['qc', 'qc123', 'Quality Control', 'QUALITY_CONTROL', 'TIDAK', 'TIDAK', 'TIDAK', 'TIDAK', 'TIDAK', 'AKTIF'],
    ['spv', 'spv123', 'Supervisor', 'SUPERVISOR', 'YA', 'YA', 'YA', 'YA', 'YA', 'AKTIF'],
    ['admin', 'admin123', 'Admin IT', 'ADMIN', 'TIDAK', 'TIDAK', 'TIDAK', 'TIDAK', 'TIDAK', 'AKTIF']
  ];
}

function ensureDefaultUser_(sheet, userRow) {
  const lastRow = sheet.getLastRow();
  const usernames = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(row) { return row[0]; })
    : [];

  const exists = usernames.some(function(username) {
    return sameText_(username, userRow[0]);
  });

  if (!exists) {
    sheet.appendRow(userRow);
  }
}

function repairDatabaseUserRows_(sheet) {
  if (!sheet) return;
  const headers = CONFIG.headers.dbUser;
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const values = range.getValues().map(function(row) {
    const username = clean_(row[0]);
    const role = clean_(row[3]);
    const roleKey = normalizeKey_(role);
    const isSpv = roleKey === 'SUPERVISOR' || roleKey === 'SPV';
    const isIn = roleKey === 'KOORDINATOR_IN' || roleKey === 'IN' || roleKey === 'BARANG MASUK' || roleKey === 'GUDANG IN';
    const isOut = roleKey === 'KOORDINATOR_OUT' || roleKey === 'OUT' || roleKey === 'BARANG KELUAR' || roleKey === 'GUDANG OUT';
    const isInv = roleKey === 'INVENTORY' || roleKey === 'INVENTARIS';
    const isAdmin = roleKey === 'ADMIN' || roleKey === 'ADMIN IT' || roleKey === 'ADMIN_IT';
    if (username && !clean_(row[2])) row[2] = username;
    if (role && !clean_(row[4])) row[4] = (isSpv || isIn) ? 'YA' : 'TIDAK';
    if (role && !clean_(row[5])) row[5] = (isSpv || isOut) ? 'YA' : 'TIDAK';
    if (role && !clean_(row[6])) row[6] = (isSpv || isOut) ? 'YA' : 'TIDAK';
    if (role && !clean_(row[7])) row[7] = (isSpv || isInv) ? 'YA' : 'TIDAK';
    if (role && !clean_(row[8])) row[8] = isSpv ? 'YA' : 'TIDAK';
    if (isAdmin && !clean_(row[8])) row[8] = 'TIDAK';
    if (!clean_(row[9])) row[9] = 'AKTIF';
    return row;
  });
  range.setValues(values);
}


function getOrCreateSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

function setHeaders_(sheet, headers) {
  if (!headers || !headers.length) return;
  syncSheetStructureByHeader_(sheet, headers);
}

function syncSheetStructureByHeader_(sheet, targetHeaders) {
  targetHeaders = (targetHeaders || []).map(function(header) { return clean_(header); });
  if (!targetHeaders.length) return;

  const targetLength = targetHeaders.length;
  if (sheet.getMaxColumns() < targetLength) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), targetLength - sheet.getMaxColumns());
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(sheet.getLastColumn(), targetLength);
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(header) { return clean_(header); });
  const currentHeaderKeys = currentHeaders.map(headerKey_);
  const targetHeaderKeys = targetHeaders.map(headerKey_);

  const headerAlreadySynced = targetHeaderKeys.every(function(key, idx) {
    return currentHeaderKeys[idx] === key;
  });

  if (headerAlreadySynced) {
    sheet.getRange(1, 1, 1, targetLength).setValues([targetHeaders]);
    return;
  }

  const indexByHeader = {};
  currentHeaderKeys.forEach(function(key, idx) {
    if (key && indexByHeader[key] === undefined) indexByHeader[key] = idx;
  });

  const hasRecognizedHeaders = targetHeaderKeys.some(function(key) {
    return indexByHeader[key] !== undefined;
  });

  if (lastRow > 1 && hasRecognizedHeaders) {
    const oldValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const newValues = oldValues.map(function(row) {
      return targetHeaderKeys.map(function(targetKey) {
        const sourceIndex = indexByHeader[targetKey];
        return sourceIndex === undefined ? '' : row[sourceIndex];
      });
    });

    sheet.getRange(1, 1, lastRow, targetLength).clearContent();
    sheet.getRange(1, 1, 1, targetLength).setValues([targetHeaders]);
    if (newValues.length) sheet.getRange(2, 1, newValues.length, targetLength).setValues(newValues);
  } else {
    sheet.getRange(1, 1, 1, targetLength).setValues([targetHeaders]);
  }
}

function headerKey_(value) {
  return normalizeKey_(value).replace(/[^A-Z0-9]+/g, '');
}

function repairSheetRelations_() {
  const ss = getInventorySpreadsheet_();
  Object.keys(CONFIG.sheets).forEach(function(key) {
    const sheetName = CONFIG.sheets[key];
    const headers = CONFIG.headers[key] || [];
    if (!headers.length) return;
    const sheet = getOrCreateSheet_(ss, sheetName);
    syncSheetStructureByHeader_(sheet, headers);
  });
}

function validateConfiguredHeaders_() {
  const ss = getInventorySpreadsheet_();
  Object.keys(CONFIG.headers).forEach(function(key) {
    const sheetName = CONFIG.sheets[key];
    const expectedHeaders = CONFIG.headers[key] || [];
    if (!sheetName || !expectedHeaders.length) return;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Relasi sheet belum siap: sheet ' + sheetName + ' tidak ditemukan.');
    const maxCol = Math.max(sheet.getLastColumn(), expectedHeaders.length);
    const actualHeaders = sheet.getRange(1, 1, 1, maxCol).getValues()[0].map(function(header) { return clean_(header); });
    expectedHeaders.forEach(function(expected, idx) {
      if (headerKey_(actualHeaders[idx]) !== headerKey_(expected)) {
        throw new Error('Relasi header sheet ' + sheetName + ' tidak sinkron pada kolom ' + (idx + 1) + '. Seharusnya "' + expected + '", terbaca "' + (actualHeaders[idx] || '-') + '". Jalankan menu Inventory Barang > Setup / Perbaiki Sheet.');
      }
    });
  });
}

function ensureSheetForWrite_(sheetName, headerKey) {
  const sheet = getSheet_(sheetName);
  const headers = CONFIG.headers[headerKey] || [];
  if (headers.length) setHeaders_(sheet, headers);
  return sheet;
}

function appendRowByHeader_(sheetName, headerKey, values) {
  const sheet = ensureSheetForWrite_(sheetName, headerKey);
  const headers = CONFIG.headers[headerKey] || [];
  const row = (values || []).slice(0, headers.length);
  while (row.length < headers.length) row.push('');
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function getSheet_(name) {
  const ss = getInventorySpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    const key = Object.keys(CONFIG.sheets).find(function(k) { return CONFIG.sheets[k] === name; });
    if (key) {
      sheet = ss.insertSheet(name);
      setHeaders_(sheet, CONFIG.headers[key]);
    }
  }
  if (!sheet) throw new Error('Sheet tidak ditemukan: ' + name + '. Jalankan setupInventorySystem() dahulu.');
  return sheet;
}

function readDb_(sheetName) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
}


function getServerNowJakarta() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    tanggal: Utilities.formatDate(now, CONFIG.timezone, 'yyyy-MM-dd'),
    jam: Utilities.formatDate(now, CONFIG.timezone, 'HH:mm:ss'),
    display: Utilities.formatDate(now, CONFIG.timezone, 'dd/MM/yyyy HH:mm:ss')
  };
}

function getMasterData() {
  // FIX FRONTEND DATABASE:
  // Jangan biarkan dashboard/frontend gagal hanya karena relasi tambahan lambat/error.
  // Semua data utama untuk tampilan dibaca langsung dari Spreadsheet dengan header mapping.
  let setupWarning = '';
  try {
    ensureSystemReady_();
  } catch (err) {
    setupWarning = err && err.message ? err.message : String(err);
  }

  const data = buildFrontendDatabase_({ includeOtdr: true, onlyAvailableStock: true });
  if (setupWarning) {
    data.syncWarning = (data.syncWarning ? data.syncWarning + ' | ' : '') + 'Setup warning: ' + setupWarning;
  }
  return data;
}

function getFrontendDatabaseData(payload) {
  payload = payload || {};
  // Dipakai frontend sebagai jalur cepat/fallback setelah login.
  // Validasi login dibuat aman: bila token habis, pesan error jelas tampil di frontend.
  if (payload.auth) validateAuth_(payload.auth, '');
  return buildFrontendDatabase_({ includeOtdr: true, onlyAvailableStock: payload.onlyAvailableStock !== false });
}

function getQcFifoMonitoring(payload) {
  payload = payload || {};
  // Endpoint khusus menu QC FIFO/FEFO.
  // Tujuannya agar frontend QC tidak tergantung penuh pada render awal dashboard/master data.
  const login = validateAuth_(payload.auth || {}, 'fifoQc');
  let rows = getFrontendStockRows_({ onlyAvailable: true });

  const today = new Date();
  rows = rows.map(function(item) {
    const days = daysBetweenDates_(today, item.tanggalExpired);
    const kategoriStatus = mapStockDashboardStatus_(item.status);
    return Object.assign({}, item, {
      daysToExpired: days,
      statusQcKategori: kategoriStatus,
      bisaUpdateQcFifo: kategoriStatus === 'HOLD' || kategoriStatus === 'RELEASE'
    });
  }).sort(function(a, b) {
    const byName = String(a.namaBarang || '').localeCompare(String(b.namaBarang || ''));
    if (byName !== 0) return byName;
    const byExp = toNumber_(a.daysToExpired) - toNumber_(b.daysToExpired);
    if (byExp !== 0) return byExp;
    const byProd = String(a.tanggalProduksi || '').localeCompare(String(b.tanggalProduksi || ''));
    if (byProd !== 0) return byProd;
    return String(a.idStock || '').localeCompare(String(b.idStock || ''));
  });

  return {
    ok: true,
    rows: rows,
    summary: {
      totalLot: rows.length,
      priorityLot: rows.filter(function(item) { return toNumber_(item.daysToExpired) <= 30; }).length,
      expiredLot: rows.filter(function(item) { return toNumber_(item.daysToExpired) < 0; }).length,
      holdLot: rows.filter(function(item) { return mapStockDashboardStatus_(item.status) === 'HOLD'; }).length
    },
    user: clean_(login.namaUser),
    generatedAt: dateTimeDisplay_(new Date())
  };
}

function buildFrontendDatabase_(options) {
  options = options || {};
  let syncWarning = '';
  try {
    safeSyncRelasiRakBatch_();
  } catch (err) {
    syncWarning = err && err.message ? err.message : String(err);
  }

  const stockRows = getFrontendStockRows_({ onlyAvailable: options.onlyAvailableStock !== false });
  const otdrRows = options.includeOtdr ? safeReadOtdrSummaryForDashboard_() : [];
  const resto = safeReadRestoDb_();

  return {
    ok: true,
    barang: safeReadDb_(CONFIG.sheets.dbBarang).map(function(row) {
      return { nama: clean_(row[0]), satuan: clean_(row[1]), status: clean_(row[2]), rak: clean_(row[3]), expiredBulan: row[4] };
    }).filter(function(item) { return item.nama; }),
    status: safeReadDb_(CONFIG.sheets.dbStatus).map(function(row) { return clean_(row[0]); }).filter(String),
    koordinator: safeReadDb_(CONFIG.sheets.dbKoordinator).map(function(row) {
      return row[1] ? clean_(row[0]) + ' - ' + clean_(row[1]) : clean_(row[0]);
    }).filter(String),
    rak: safeReadRackCapacityRows_().map(function(row) { return clean_(row.lokasiRak); }).filter(String),
    rakLastOut: safeGetRackLastOutRows_(),
    rakKapasitas: safeReadRackCapacityRows_().map(function(item) {
      return {
        lokasiRak: item.lokasiRak,
        kapasitasRak: item.kapasitasRak,
        jenisRak: item.jenisRak,
        hitungOccupancy: item.hitungOccupancy
      };
    }),
    resto: resto,
    stock: stockRows,
    lotRakBatch: safeGetRelasiRakBatchRows_(stockRows),
    otdr: otdrRows,
    summary: buildStockSummary_(stockRows, otdrRows),
    syncWarning: syncWarning,
    debug: {
      stockSheet: CONFIG.sheets.stock,
      stockRowsLoaded: stockRows.length,
      generatedAt: dateTimeDisplay_(new Date())
    }
  };
}

function buildStockSummary_(stockRows, otdrRows) {
  stockRows = Array.isArray(stockRows) ? stockRows : [];
  otdrRows = Array.isArray(otdrRows) ? otdrRows : [];
  const today = new Date();
  const expSoonRows = stockRows.filter(function(item) {
    const days = daysBetweenDates_(today, item.tanggalExpired);
    return days <= 30;
  });
  const pendingRows = otdrRows.filter(function(item) { return !isOtdrDoneStatus_(item.statusOtdr); });
  return {
    totalQty: stockRows.reduce(function(sum, item) { return sum + toNumber_(item.stockOnhand); }, 0),
    totalLot: stockRows.length,
    expSoon: expSoonRows.length,
    otdrPending: pendingRows.length
  };
}

function safeReadDb_(sheetName) {
  try { return readDb_(sheetName); } catch (err) { return []; }
}

function safeReadRestoDb_() {
  try { return readRestoDb_(); } catch (err) { return []; }
}

function safeReadRackCapacityRows_() {
  try { return readRackCapacityRows_(); } catch (err) { return []; }
}

function safeGetRackLastOutRows_() {
  try { return getRackLastOutRows_(); } catch (err) { return []; }
}

function safeReadOtdrSummaryForDashboard_() {
  try { return getOtdrSummaryForDashboard_(); } catch (err) { return []; }
}

function safeGetRelasiRakBatchRows_(fallbackStockRows) {
  try {
    const rows = getRelasiRakBatchRows_();
    if (rows && rows.length) return rows;
  } catch (err) {}
  return (fallbackStockRows || []).map(function(item) {
    return {
      timestampSync: '',
      idStock: clean_(item.idStock),
      lotKey: clean_(item.lotKey),
      lokasiRak: clean_(item.lokasiRak),
      nomorBatch: clean_(item.nomorBatch),
      namaBarang: clean_(item.namaBarang),
      tanggalProduksi: dateDisplay_(item.tanggalProduksi),
      tanggalExpired: dateDisplay_(item.tanggalExpired),
      status: clean_(item.status),
      stockOnhand: toNumber_(item.stockOnhand),
      satuan: clean_(item.satuan),
      nomorBSTB: clean_(item.nomorBSTB),
      tanggalBSTB: dateDisplay_(item.tanggalBSTB),
      lastUpdate: dateTimeDisplay_(item.lastUpdate),
      namaUserInputTerakhir: clean_(item.namaUserInputTerakhir)
    };
  });
}

function getFrontendStockRows_(filter) {
  filter = filter || {};
  const sheet = getSheet_(CONFIG.sheets.stock);
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.headers.stock.length);
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return clean_(h); });
  const indexByHeader = {};
  headers.forEach(function(header, idx) {
    const key = headerKey_(header);
    if (key && indexByHeader[key] === undefined) indexByHeader[key] = idx;
  });

  function idx_(aliases, fallbackIndex) {
    aliases = Array.isArray(aliases) ? aliases : [aliases];
    for (let i = 0; i < aliases.length; i++) {
      const key = headerKey_(aliases[i]);
      if (indexByHeader[key] !== undefined) return indexByHeader[key];
    }
    return fallbackIndex;
  }

  const idx = {
    idStock: idx_(['ID Stock', 'ID Lot', 'Lot ID', 'ID'], 0),
    namaBarang: idx_(['Nama Barang', 'Nama Item', 'Item', 'Material', 'Nama Material'], 1),
    tanggalProduksi: idx_(['Tanggal Produksi', 'Tgl Produksi', 'Production Date', 'Tanggal Prod'], 2),
    tanggalExpired: idx_(['Tanggal Expired', 'Tgl Expired', 'Expired', 'Expiry Date', 'EXP'], 3),
    status: idx_(['Status', 'Status QC'], 4),
    lokasiRak: idx_(['Lokasi Rak', 'Rak', 'Lokasi', 'Location'], 5),
    qtyMasuk: idx_(['Qty Masuk', 'QTY Masuk', 'Qty In', 'Total Qty'], 6),
    qtyKeluar: idx_(['Qty Keluar', 'QTY Keluar', 'Qty Out'], 7),
    stockOnhand: idx_(['Stock Onhand', 'Stock On Hand', 'Onhand', 'On Hand', 'Qty Onhand', 'QTY Onhand', 'Qty Stock', 'Stock', 'Saldo', 'Saldo Akhir Lot'], 8),
    satuan: idx_(['Satuan', 'UOM', 'Unit'], 9),
    nomorBSTB: idx_(['Nomor Bukti Serah Terima Barang', 'Nomor BSTB', 'No BSTB', 'BSTB'], 10),
    tanggalBSTB: idx_(['Tanggal Bukti Serah Terima Barang', 'Tanggal BSTB', 'Tgl BSTB'], 11),
    nomorITKirim: idx_(['Nomor IT Kirim Terakhir', 'Nomor IT Kirim', 'IT Kirim'], 12),
    lastUpdate: idx_(['Last Update', 'Timestamp Update'], 13),
    lotKey: idx_(['Key Lot', 'Lot Key', 'Key'], 14),
    namaUserInputTerakhir: idx_(['Nama User Input Terakhir', 'Nama User Transaksi', 'PIC', 'User Input'], 15),
    nomorITTerima: idx_(['Nomor IT Terima Terakhir', 'Nomor IT Terima', 'IT Terima'], 16),
    lastUpdateITTerima: idx_(['Last Update IT Terima', 'Tanggal Update IT Terima'], 17),
    adminITTerima: idx_(['Admin IT Terima', 'Admin Update IT Terima'], 18),
    nomorBatch: idx_(['Nomor Batch', 'No Batch', 'Batch', 'Batch Number', 'Lot Batch'], 19)
  };

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  let rows = values.map(function(row, index) {
    const idStock = clean_(row[idx.idStock]) || ('ROW-' + (index + 2));
    const namaBarang = clean_(row[idx.namaBarang]);
    const stockOnhand = toNumber_(row[idx.stockOnhand]);
    return {
      row: index + 2,
      idStock: idStock,
      namaBarang: namaBarang,
      tanggalProduksi: row[idx.tanggalProduksi],
      tanggalExpired: row[idx.tanggalExpired],
      status: clean_(row[idx.status]),
      lokasiRak: clean_(row[idx.lokasiRak]),
      qtyMasuk: toNumber_(row[idx.qtyMasuk]),
      qtyKeluar: toNumber_(row[idx.qtyKeluar]),
      stockOnhand: stockOnhand,
      satuan: clean_(row[idx.satuan]) || 'CARTON',
      nomorBSTB: clean_(row[idx.nomorBSTB]),
      tanggalBSTB: row[idx.tanggalBSTB],
      nomorITKirim: clean_(row[idx.nomorITKirim]),
      lastUpdate: row[idx.lastUpdate],
      lotKey: clean_(row[idx.lotKey]),
      namaUserInputTerakhir: clean_(row[idx.namaUserInputTerakhir]),
      nomorITTerima: clean_(row[idx.nomorITTerima]),
      lastUpdateITTerima: row[idx.lastUpdateITTerima],
      adminITTerima: clean_(row[idx.adminITTerima]),
      nomorBatch: clean_(row[idx.nomorBatch])
    };
  }).filter(function(item) {
    // Tampilkan baris bila minimal ada nama barang atau ID stock asli.
    return clean_(item.namaBarang) || clean_(item.idStock);
  });

  if (filter.onlyAvailable !== false) rows = rows.filter(function(item) { return toNumber_(item.stockOnhand) > 0; });
  if (filter.namaBarang) rows = rows.filter(function(item) { return sameText_(item.namaBarang, filter.namaBarang); });
  if (filter.lokasiRak) rows = rows.filter(function(item) { return sameText_(item.lokasiRak, filter.lokasiRak); });
  if (filter.status) rows = rows.filter(function(item) { return sameText_(item.status, filter.status); });

  rows.sort(function(a, b) {
    const byName = String(a.namaBarang || '').localeCompare(String(b.namaBarang || ''));
    if (byName !== 0) return byName;
    const expA = a.tanggalExpired ? new Date(a.tanggalExpired).getTime() : 0;
    const expB = b.tanggalExpired ? new Date(b.tanggalExpired).getTime() : 0;
    return expA - expB;
  });

  return rows.map(function(item) {
    return {
      idStock: item.idStock,
      namaBarang: item.namaBarang,
      tanggalProduksi: dateDisplay_(item.tanggalProduksi),
      tanggalExpired: dateDisplay_(item.tanggalExpired),
      status: item.status,
      lokasiRak: item.lokasiRak,
      qtyMasuk: item.qtyMasuk,
      qtyKeluar: item.qtyKeluar,
      stockOnhand: item.stockOnhand,
      satuan: item.satuan,
      nomorBSTB: item.nomorBSTB,
      tanggalBSTB: dateDisplay_(item.tanggalBSTB),
      nomorITKirim: item.nomorITKirim,
      namaUserInputTerakhir: item.namaUserInputTerakhir,
      nomorBatch: item.nomorBatch,
      lotKey: item.lotKey,
      lastUpdate: dateTimeDisplay_(item.lastUpdate),
      row: item.row
    };
  });
}

function getDashboardSummaryData(payload) {
  payload = payload || {};
  validateAuth_(payload.auth || {}, '');
  const data = buildFrontendDatabase_({ includeOtdr: true, onlyAvailableStock: true });
  const today = new Date();
  const expiringRows = (data.stock || []).slice().sort(function(a, b) {
    return daysBetweenDates_(today, a.tanggalExpired) - daysBetweenDates_(today, b.tanggalExpired);
  }).slice(0, 6);
  return {
    ok: true,
    stock: data.stock || [],
    lotRakBatch: data.lotRakBatch || [],
    otdr: data.otdr || [],
    barang: data.barang || [],
    status: data.status || [],
    koordinator: data.koordinator || [],
    rak: data.rak || [],
    rakKapasitas: data.rakKapasitas || [],
    resto: data.resto || [],
    summary: data.summary || buildStockSummary_(data.stock || [], data.otdr || []),
    expiringRows: expiringRows,
    syncWarning: data.syncWarning || '',
    debug: data.debug || {}
  };
}

function daysBetweenDates_(fromDate, targetDate) {
  if (!targetDate) return 999999;
  const from = new Date(fromDate);
  const target = targetDate instanceof Date ? new Date(targetDate) : toDate_(targetDate);
  if (!target || isNaN(target.getTime())) return 999999;
  const fromKey = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const targetKey = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.ceil((targetKey - fromKey) / 86400000);
}

function getOtdrSummaryForDashboard_() {
  const sheet = getSheet_(CONFIG.sheets.otdr);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  // Ambil kolom Status OTDR saja supaya dashboard/master data cepat dan tidak gagal karena data OTDR besar.
  return sheet.getRange(2, 15, lastRow - 1, 1).getValues().map(function(row) {
    return { statusOtdr: clean_(row[0]) };
  });
}

function readRestoDb_() {
  return readDb_(CONFIG.sheets.dbResto).map(function(row, idx) {
    const kode = clean_(row[0]);
    const nama = clean_(row[1]);
    const nopol = clean_(row[2]);
    const wa = clean_(row[3]);
    const sopir = clean_(row[4]);
    const ket = clean_(row[5]);
    return {
      id: 'RESTO-' + (idx + 2),
      rowNumber: idx + 2,
      kode: kode,
      nama: nama,
      nopol: nopol,
      wa: wa,
      sopir: sopir,
      keterangan: ket,
      label: kode + ' - ' + nama + ' | ' + nopol + ' | ' + sopir
    };
  }).filter(function(item) { return item.kode; });
}


function getRackLastOutRows_() {
  const sheet = getSheet_(CONFIG.sheets.barangKeluar);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.barangKeluar.length).getValues();
  const latestByRack = {};

  values.forEach(function(row, idx) {
    const lokasiRak = clean_(row[13]);
    if (!lokasiRak) return;

    const tanggalDimuat = row[1] || row[0];
    let sortTime = idx + 1;
    try {
      const dateForSort = toDate_(tanggalDimuat || row[0]);
      if (dateForSort) sortTime = dateForSort.getTime() + idx;
    } catch (err) {
      sortTime = idx + 1;
    }

    const key = normalizeKey_(lokasiRak);
    const current = latestByRack[key];
    if (current && toNumber_(current.sortTime) > sortTime) return;

    latestByRack[key] = {
      lokasiRak: lokasiRak,
      tanggalKeluar: dateDisplay_(tanggalDimuat),
      timestampKeluar: dateTimeDisplay_(row[0]),
      namaBarang: clean_(row[7]),
      qtyKeluar: row[8],
      satuan: clean_(row[9]),
      shiftKoordinator: clean_(row[10]),
      nomorSuratJalan: clean_(row[11]),
      nomorITKirim: clean_(row[12]),
      idStock: clean_(row[14]),
      nomorBSTB: clean_(row[15]),
      nomorBatch: clean_(row[22]),
      idOtdr: clean_(row[17]),
      kodeResto: clean_(row[2]),
      namaResto: clean_(row[3]),
      keterangan: clean_(row[18]),
      namaUserTransaksi: clean_(row[19]),
      sortTime: sortTime
    };
  });

  return Object.keys(latestByRack).map(function(key) {
    return latestByRack[key];
  }).sort(function(a, b) {
    return normalizeKey_(a.lokasiRak).localeCompare(normalizeKey_(b.lokasiRak));
  });
}


function getRackLastOutByRack_(lokasiRak) {
  const key = normalizeKey_(lokasiRak);
  if (!key) return null;
  return getRackLastOutRows_().find(function(item) {
    return normalizeKey_(item.lokasiRak) === key;
  }) || null;
}


function ensureRackCapacityHeader_() {
  const sheet = getSheet_(CONFIG.sheets.dbRak);
  if (sheet.getLastColumn() < CONFIG.headers.dbRak.length) {
    sheet.getRange(1, 1, 1, CONFIG.headers.dbRak.length).setValues([CONFIG.headers.dbRak]);
  } else {
    if (!clean_(sheet.getRange(1, 1).getValue())) sheet.getRange(1, 1).setValue('Lokasi Rak');
    if (!clean_(sheet.getRange(1, 2).getValue())) sheet.getRange(1, 2).setValue('Kapasitas Rak');
    if (!clean_(sheet.getRange(1, 3).getValue())) sheet.getRange(1, 3).setValue('Jenis Rak');
  }
  updateRackTypesFromCode_(sheet);
  return sheet;
}

function inferRackTypeByCode_(lokasiRak) {
  const key = normalizeKey_(lokasiRak);
  if (!key) return '';
  // Kode rak GANGWAY dan T = FLOOR. Kode rak R/RAK = DEDICATED.
  if (key.indexOf('GANGWAY') !== -1 || key.indexOf('GANG WAY') !== -1 || key.indexOf('GANG') === 0 || key.indexOf('T') === 0) return 'FLOOR';
  if (key.indexOf('R') === 0 || key.indexOf('RAK') === 0) return 'DEDICATED';
  // Selain kode R/RAK dianggap FLOOR agar kapasitas occupancy hanya benar-benar dari rak dedicated.
  return 'FLOOR';
}

function normalizeRackType_(jenisRak, lokasiRak) {
  const key = normalizeKey_(jenisRak);
  if (key === 'FLOOR' || key === 'LANTAI' || key === 'GANGWAY' || key === 'GANG WAY') return 'FLOOR';
  if (key === 'DEDICATED' || key === 'RAK DEDICATED' || key === 'RACK DEDICATED') return 'DEDICATED';
  return inferRackTypeByCode_(lokasiRak);
}

function isDedicatedRack_(item) {
  return normalizeRackType_(item && item.jenisRak, item && item.lokasiRak) === 'DEDICATED';
}

function updateRackTypesFromCode_(sheet) {
  sheet = sheet || getSheet_(CONFIG.sheets.dbRak);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const updates = [];
  let changed = false;
  values.forEach(function(row) {
    const lokasiRak = clean_(row[0]);
    const currentType = clean_(row[2]);
    const finalType = normalizeRackType_(currentType, lokasiRak);
    updates.push([finalType]);
    if (lokasiRak && currentType !== finalType) changed = true;
  });
  if (changed) sheet.getRange(2, 3, updates.length, 1).setValues(updates);
}

function readRackCapacityRows_() {
  const sheet = ensureRackCapacityHeader_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.headers.dbRak.length);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(function(row, index) {
    const lokasiRak = clean_(row[0]);
    const jenisRak = normalizeRackType_(row[2], lokasiRak);
    return {
      row: index + 2,
      lokasiRak: lokasiRak,
      kapasitasRak: toNumber_(row[1]),
      jenisRak: jenisRak,
      hitungOccupancy: jenisRak === 'DEDICATED'
    };
  }).filter(function(item) { return item.lokasiRak; });
}

function saveRackCapacities(payload) {
  payload = payload || {};
  const user = validateAuth_(payload.auth || {}, 'supervisor');
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const sheet = ensureRackCapacityHeader_();
  const existing = readRackCapacityRows_();
  const rowByRack = {};

  existing.forEach(function(item) {
    rowByRack[normalizeKey_(item.lokasiRak)] = item.row;
  });

  let saved = 0;
  rows.forEach(function(item) {
    const lokasiRak = clean_(item && item.lokasiRak);
    if (!lokasiRak) return;

    const kapasitasRak = toNumber_(item.kapasitasRak);
    if (kapasitasRak < 0) throw new Error('Kapasitas rak tidak boleh minus: ' + lokasiRak);
    const jenisRak = normalizeRackType_(item && item.jenisRak, lokasiRak);

    const key = normalizeKey_(lokasiRak);
    const rowNumber = rowByRack[key];
    if (rowNumber) {
      sheet.getRange(rowNumber, 2).setValue(kapasitasRak);
      sheet.getRange(rowNumber, 3).setValue(jenisRak);
    } else {
      sheet.appendRow([lokasiRak, kapasitasRak, jenisRak]);
      rowByRack[key] = sheet.getLastRow();
    }
    saved += 1;
  });

  return {
    ok: true,
    message: 'Kapasitas dan jenis rak berhasil disimpan oleh ' + user.namaUser + '. Total update: ' + saved + ' rak. Occupancy hanya menghitung rak DEDICATED.',
    rows: readRackCapacityRows_().map(function(item) {
      return {
        lokasiRak: item.lokasiRak,
        kapasitasRak: item.kapasitasRak,
        jenisRak: item.jenisRak,
        hitungOccupancy: item.hitungOccupancy
      };
    })
  };
}

function getWarehouseOccupancyReport(payload) {
  payload = payload || {};
  const user = validateAuth_(payload.auth || {}, 'occupancy');

  const today = startOfDay_(new Date());
  const endDate = payload.endDate ? startOfDay_(payload.endDate) : today;
  const startDate = payload.startDate ? startOfDay_(payload.startDate) : new Date(endDate.getTime());
  if (!payload.startDate) startDate.setDate(startDate.getDate() - 13);

  if (startDate.getTime() > endDate.getTime()) throw new Error('Tanggal awal tidak boleh lebih besar dari tanggal akhir.');

  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (dayCount > 90) throw new Error('Range grafik maksimal 90 hari agar aplikasi tetap ringan.');

  const rackCapacities = readRackCapacityRows_();
  const dedicatedRackCapacities = rackCapacities.filter(function(item) { return isDedicatedRack_(item); });
  const capacityTotal = dedicatedRackCapacities.reduce(function(sum, item) {
    return sum + Math.max(0, toNumber_(item.kapasitasRak));
  }, 0);
  const capacityRackCount = dedicatedRackCapacities.filter(function(item) { return toNumber_(item.kapasitasRak) > 0; }).length;
  const todayKey = dateKey_(today);

  const daily = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate.getTime());
    d.setDate(startDate.getDate() + i);
    const key = dateKey_(d);
    const snapshotRows = key === todayKey
      ? getCurrentStockSnapshotRows_()
      : key < todayKey
        ? getHistoricalStockSnapshotRows_(d)
        : [];

    daily.push(calculateOccupancySnapshot_(snapshotRows, rackCapacities, d, capacityTotal, capacityRackCount));
  }

  const summary = daily.length ? daily[daily.length - 1] : calculateOccupancySnapshot_([], rackCapacities, endDate, capacityTotal, capacityRackCount);

  return {
    generatedAt: dateTimeDisplay_(new Date()),
    generatedBy: user.namaUser,
    startDate: dateDisplay_(startDate),
    endDate: dateDisplay_(endDate),
    capacity: {
      total: capacityTotal,
      totalRack: dedicatedRackCapacities.length,
      rackWithCapacity: capacityRackCount,
      floorRack: rackCapacities.length - dedicatedRackCapacities.length,
      basis: 'DEDICATED_ONLY'
    },
    summary: summary,
    daily: daily,
    rackCapacities: rackCapacities.map(function(item) {
      return {
        lokasiRak: item.lokasiRak,
        kapasitasRak: item.kapasitasRak,
        jenisRak: item.jenisRak,
        hitungOccupancy: item.hitungOccupancy
      };
    })
  };
}

function calculateOccupancySnapshot_(snapshotRows, rackCapacities, dateValue, capacityTotal, capacityRackCount) {
  let releaseQty = 0;
  let holdQty = 0;
  let wasteQty = 0;
  let totalQty = 0;
  let floorQty = 0;
  const occupiedRack = {};
  const floorOccupiedRack = {};
  const dedicatedRackMap = {};

  rackCapacities.forEach(function(rack) {
    dedicatedRackMap[normalizeKey_(rack.lokasiRak)] = isDedicatedRack_(rack);
  });

  snapshotRows.forEach(function(item) {
    const qty = toNumber_(item.stockOnhand);
    if (qty <= 0) return;

    const rackKey = normalizeKey_(item.lokasiRak);
    const isDedicated = dedicatedRackMap.hasOwnProperty(rackKey)
      ? dedicatedRackMap[rackKey]
      : normalizeRackType_('', item.lokasiRak) === 'DEDICATED';

    if (!isDedicated) {
      floorQty += qty;
      if (rackKey) floorOccupiedRack[rackKey] = true;
      return;
    }

    const kategori = mapStockDashboardStatus_(item.status);
    if (kategori === 'HOLD') holdQty += qty;
    else if (kategori === 'RELEASE') releaseQty += qty;
    else wasteQty += qty;

    totalQty += qty;
    if (rackKey) occupiedRack[rackKey] = true;
  });

  function pct_(qty) {
    return capacityTotal > 0 ? Math.round((toNumber_(qty) / capacityTotal) * 1000) / 10 : 0;
  }

  const usedPct = pct_(totalQty);
  return {
    tanggal: dateDisplay_(dateValue),
    tanggalLabel: Utilities.formatDate(toDate_(dateValue), CONFIG.timezone, 'dd/MM'),
    releaseQty: Math.round(releaseQty),
    holdQty: Math.round(holdQty),
    wasteQty: Math.round(wasteQty),
    totalQty: Math.round(totalQty),
    floorQty: Math.round(floorQty),
    spaceQty: Math.max(0, Math.round(capacityTotal - totalQty)),
    capacityTotal: Math.round(capacityTotal),
    rackCountTotal: rackCapacities.filter(function(item) { return isDedicatedRack_(item); }).length,
    rackWithCapacity: capacityRackCount,
    occupiedRackCount: Object.keys(occupiedRack).length,
    floorOccupiedRackCount: Object.keys(floorOccupiedRack).length,
    releasePct: pct_(releaseQty),
    holdPct: pct_(holdQty),
    totalPct: usedPct,
    spacePct: Math.max(0, Math.round((100 - usedPct) * 10) / 10)
  };
}

function getRestoById_(restoId) {
  const list = readRestoDb_();
  return list.find(function(item) { return sameText_(item.id, restoId); }) || null;
}


function loginUser(credentials) {
  const loginSetup = safeEnsureSystemReadyForLogin_();
  SpreadsheetApp.flush();
  credentials = credentials || {};
  const username = clean_(credentials.username || credentials.user || credentials.email);
  const password = String(credentials.password || credentials.pass || '').trim();
  if (!username || !password) throw new Error('Username dan password wajib diisi.');

  const user = getUserByUsername_(username);
  if (!user) throw new Error('Username tidak ditemukan di DATABASE_USER. Cek kolom Username atau jalankan repairLoginAndBackendRouting().');
  if (!isActiveUserStatus_(user.status)) throw new Error('User tidak aktif. Hubungi supervisor/admin.');
  if (String(user.password) !== password) throw new Error('Password salah.');

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('INV_AUTH_' + token, user.username, 21600); // 6 jam
  return { ok: true, token: token, user: sanitizeUser_(user), setupWarning: loginSetup.warning || '' };
}

function restoreLogin(auth) {
  safeEnsureSystemReadyForLogin_();
  SpreadsheetApp.flush();
  const user = validateAuth_(auth, '');
  return { ok: true, user: sanitizeUser_(user) };
}

function logoutUser(auth) {
  if (auth && auth.token) {
    CacheService.getScriptCache().remove('INV_AUTH_' + auth.token);
  }
  return { ok: true };
}

function readUserDb_() {
  const sheet = getSheet_(CONFIG.sheets.dbUser);
  const lastRow = sheet.getLastRow();
  const maxCol = Math.max(sheet.getLastColumn(), CONFIG.headers.dbUser.length);
  if (lastRow < 2) return [];

  const headerKeys = sheet.getRange(1, 1, 1, maxCol).getValues()[0].map(headerKey_);
  const indexByHeader = {};
  headerKeys.forEach(function(key, idx) {
    if (key && indexByHeader[key] === undefined) indexByHeader[key] = idx;
  });

  function userCell_(row, headerName, fallbackIndex) {
    const aliases = {
      'Username': ['Username', 'User', 'User ID', 'ID User', 'Login', 'Akun'],
      'Password': ['Password', 'Pass', 'Kata Sandi'],
      'Nama User': ['Nama User', 'Nama', 'Nama Lengkap', 'PIC'],
      'Role': ['Role', 'Akses', 'Level', 'Jabatan'],
      'Akses Barang Masuk': ['Akses Barang Masuk', 'Barang Masuk', 'Masuk', 'Akses Masuk'],
      'Akses Barang Keluar': ['Akses Barang Keluar', 'Barang Keluar', 'Keluar', 'Akses Keluar'],
      'Akses OTDR': ['Akses OTDR', 'OTDR'],
      'Akses Lokasi': ['Akses Lokasi', 'Lokasi', 'Update Lokasi', 'Inventory'],
      'Akses Supervisor': ['Akses Supervisor', 'Supervisor', 'SPV'],
      'Status': ['Status', 'Aktif']
    };
    const keys = aliases[headerName] || [headerName];
    for (let i = 0; i < keys.length; i++) {
      const idx = indexByHeader[headerKey_(keys[i])];
      if (idx !== undefined) return row[idx];
    }
    return row[fallbackIndex];
  }

  return sheet.getRange(2, 1, lastRow - 1, maxCol).getValues().map(function(row) {
    const role = clean_(userCell_(row, 'Role', 3));
    const roleKey = normalizeKey_(role);
    const accessSupervisor = userCell_(row, 'Akses Supervisor', 8);
    const supervisor = isYes_(accessSupervisor) || roleKey === 'SUPERVISOR' || roleKey === 'SPV';
    const roleBarangMasuk = roleKey === 'KOORDINATOR_IN' || roleKey === 'IN' || roleKey === 'BARANG MASUK' || roleKey === 'GUDANG IN';
    const roleBarangKeluar = roleKey === 'KOORDINATOR_OUT' || roleKey === 'OUT' || roleKey === 'BARANG KELUAR' || roleKey === 'GUDANG OUT';
    const roleInventory = roleKey === 'INVENTORY' || roleKey === 'INVENTARIS';
    const roleQualityControl = roleKey === 'QUALITY_CONTROL' || roleKey === 'QUALITY CONTROL' || roleKey === 'QUALITYCONTROL' || roleKey === 'QUALITY-CONTROL' || roleKey === 'QC' || roleKey === 'QUALITY';
    const roleAdminIt = roleKey === 'ADMIN' || roleKey === 'ADMIN IT' || roleKey === 'ADMIN_IT';
    return {
      username: clean_(userCell_(row, 'Username', 0)),
      password: String(userCell_(row, 'Password', 1) || '').trim(),
      namaUser: clean_(userCell_(row, 'Nama User', 2)) || clean_(userCell_(row, 'Username', 0)),
      role: role,
      access: {
        masuk: supervisor || roleBarangMasuk || isYes_(userCell_(row, 'Akses Barang Masuk', 4)),
        keluar: supervisor || roleBarangKeluar || isYes_(userCell_(row, 'Akses Barang Keluar', 5)),
        otdr: supervisor || roleBarangKeluar || isYes_(userCell_(row, 'Akses OTDR', 6)),
        lokasi: supervisor || roleInventory || isYes_(userCell_(row, 'Akses Lokasi', 7)),
        stockOpname: supervisor || roleInventory || isYes_(userCell_(row, 'Akses Lokasi', 7)),
        occupancy: supervisor || roleInventory || isYes_(userCell_(row, 'Akses Lokasi', 7)),
        fifoQc: supervisor || roleQualityControl,
        mutasi: supervisor || roleBarangMasuk || roleBarangKeluar,
        rackQr: supervisor || roleBarangMasuk || roleBarangKeluar,
        scanBarcode: supervisor || roleBarangMasuk || roleBarangKeluar,
        adminIt: supervisor || roleAdminIt,
        supervisor: supervisor
      },
      status: clean_(userCell_(row, 'Status', 9) || 'AKTIF')
    };
  }).filter(function(user) { return user.username; });
}

function getUserByUsername_(username) {
  return readUserDb_().find(function(user) { return sameText_(user.username, username); }) || null;
}

function validateAuth_(auth, requiredAccess) {
  const token = auth && auth.token ? String(auth.token) : '';
  if (!token) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');

  const username = CacheService.getScriptCache().get('INV_AUTH_' + token);
  if (!username) throw new Error('Sesi login habis. Silakan login ulang.');

  const user = getUserByUsername_(username);
  if (!user || !isActiveUserStatus_(user.status)) throw new Error('User tidak aktif atau tidak ditemukan.');

  if (requiredAccess && !user.access.supervisor && !user.access[requiredAccess]) {
    throw new Error('User ' + user.namaUser + ' tidak punya akses untuk menu ini.');
  }
  return user;
}

function sanitizeUser_(user) {
  return {
    username: user.username,
    namaUser: user.namaUser,
    role: user.role,
    access: user.access,
    status: user.status
  };
}

function isYes_(value) {
  const text = normalizeKey_(value);
  return text === 'YA' || text === 'YES' || text === 'TRUE' || text === '1' || text === 'Y';
}

function isActiveUserStatus_(value) {
  const text = normalizeKey_(value || 'AKTIF');
  return text === 'AKTIF' || text === 'ACTIVE' || text === 'YA' || text === 'YES' || text === 'TRUE' || text === '1';
}

function ensureAdminItSheet_() {
  const ss = getInventorySpreadsheet_();
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.adminIt);
  setHeaders_(sheet, CONFIG.headers.adminIt);
  return sheet;
}

function submitAdminItRows(data) {
  data = data || {};
  const login = validateAuth_(data.auth, 'adminIt');
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (rows.length === 0) throw new Error('Minimal isi 1 baris nomor IT.');

  const now = new Date();
  const values = [];

  rows.forEach(function(row, idx) {
    row = row || {};
    const tanggalIT = clean_(row.tanggalIT);
    const jenisRaw = normalizeKey_(row.jenisIT || row.jenisIt);
    const jenisIT = (jenisRaw === 'BOTH' || jenisRaw === 'TERIMA & KIRIM') ? 'TERIMA & KIRIM' : jenisRaw;
    const nomorITTerima = clean_(row.nomorITTerima);
    const nomorITKirim = clean_(row.nomorITKirim);
    const nomorReferensi = clean_(row.nomorReferensi);
    const kodeRestoSupplier = clean_(row.kodeRestoSupplier);
    const namaBarangKet = clean_(row.namaBarangKet);
    const qty = clean_(row.qty);
    const catatan = clean_(row.catatan);

    const hasAny = nomorITTerima || nomorITKirim || nomorReferensi || kodeRestoSupplier || namaBarangKet || qty || catatan;
    if (!hasAny) return;

    if (!tanggalIT) throw new Error('Baris ' + (idx + 1) + ': Tanggal IT wajib diisi.');
    if (!jenisIT) throw new Error('Baris ' + (idx + 1) + ': Jenis IT wajib dipilih.');
    if (jenisIT !== 'TERIMA' && jenisIT !== 'KIRIM' && jenisIT !== 'TERIMA & KIRIM') {
      throw new Error('Baris ' + (idx + 1) + ': Jenis IT harus TERIMA, KIRIM, atau TERIMA & KIRIM.');
    }
    if (!nomorITTerima && !nomorITKirim) {
      throw new Error('Baris ' + (idx + 1) + ': Isi minimal Nomor IT Terima atau Nomor IT Kirim.');
    }
    if (jenisIT === 'TERIMA' && !nomorITTerima) {
      throw new Error('Baris ' + (idx + 1) + ': Untuk jenis TERIMA, Nomor IT Terima wajib diisi.');
    }
    if (jenisIT === 'KIRIM' && !nomorITKirim) {
      throw new Error('Baris ' + (idx + 1) + ': Untuk jenis KIRIM, Nomor IT Kirim wajib diisi.');
    }

    values.push([
      now, toDate_(tanggalIT), jenisIT, nomorITTerima, nomorITKirim,
      nomorReferensi, kodeRestoSupplier, namaBarangKet, qty, catatan, clean_(login.namaUser),
      'MANUAL', '', 'TERSIMPAN MANUAL - belum direlasikan ke transaksi'
    ]);
  });

  if (values.length === 0) throw new Error('Tidak ada baris nomor IT yang diisi.');

  const sheet = ensureAdminItSheet_();
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, CONFIG.headers.adminIt.length).setValues(values);
  return { ok: true, count: values.length, message: values.length + ' baris nomor IT berhasil disimpan oleh ' + login.namaUser + '.' };
}

function getAdminItList(data) {
  data = data || {};
  validateAuth_(data.auth, 'adminIt');
  const sheet = ensureAdminItSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const start = data.startDate ? startOfDay_(data.startDate) : null;
  const end = data.endDate ? endOfDay_(data.endDate) : null;

  let rows = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.adminIt.length).getValues().map(function(row, idx) {
    return {
      rowNumber: idx + 2,
      timestampInput: dateTimeDisplay_(row[0]),
      tanggalITRaw: row[1],
      tanggalIT: dateDisplay_(row[1]),
      jenisIT: clean_(row[2]),
      nomorITTerima: clean_(row[3]),
      nomorITKirim: clean_(row[4]),
      nomorReferensi: clean_(row[5]),
      kodeRestoSupplier: clean_(row[6]),
      namaBarangKet: clean_(row[7]),
      qty: clean_(row[8]),
      catatan: clean_(row[9]),
      namaAdmin: clean_(row[10]),
      sumberRelasi: clean_(row[11]),
      rowTransaksi: clean_(row[12]),
      statusRelasi: clean_(row[13])
    };
  }).filter(function(item) {
    if (!item.tanggalITRaw) return false;
    const d = toDate_(item.tanggalITRaw);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  rows.sort(function(a, b) {
    return new Date(b.tanggalITRaw).getTime() - new Date(a.tanggalITRaw).getTime() || b.rowNumber - a.rowNumber;
  });

  return rows.slice(0, 100);
}


function ensureConfiguredSheetByKey_(sheetKey) {
  const sheetName = CONFIG.sheets[sheetKey];
  if (!sheetName) throw new Error('Konfigurasi sheet tidak ditemukan: ' + sheetKey);
  const sheet = getSheet_(sheetName);
  const headers = CONFIG.headers[sheetKey] || [];
  if (headers.length) setHeaders_(sheet, headers);
  return sheet;
}

function readConfiguredRowsAsObjects_(sheetKey) {
  const sheet = ensureConfiguredSheetByKey_(sheetKey);
  const headers = CONFIG.headers[sheetKey] || [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !headers.length) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function(row, idx) {
    const obj = { _rowNumber: idx + 2 };
    headers.forEach(function(header, colIdx) {
      obj[header] = row[colIdx];
    });
    return obj;
  });
}

function getHeaderColumn_(sheet, headerName) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const target = normalizeKey_(headerName);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeKey_(headers[i]) === target) return i + 1;
  }
  return 0;
}

function setCellByHeader_(sheet, rowNumber, headerName, value) {
  const col = getHeaderColumn_(sheet, headerName);
  if (!col) throw new Error('Kolom tidak ditemukan: ' + headerName + ' di sheet ' + sheet.getName());
  sheet.getRange(rowNumber, col).setValue(value);
}

function getAdminItTransactionCandidates(data) {
  data = data || {};
  validateAuth_(data.auth, 'adminIt');

  const jenis = normalizeKey_(data.jenisTransaksi || 'MASUK');
  const start = data.startDate ? startOfDay_(data.startDate) : null;
  const end = data.endDate ? endOfDay_(data.endDate) : null;
  if (!start || !end) throw new Error('Tanggal awal dan akhir wajib diisi untuk mencari transaksi.');
  if (start.getTime() > end.getTime()) throw new Error('Tanggal awal tidak boleh lebih besar dari tanggal akhir.');
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (dayCount > 31) throw new Error('Range pencarian Admin IT maksimal 31 hari agar aplikasi tetap ringan.');

  if (jenis === 'MASUK' || jenis === 'IN') return getAdminItInboundCandidates_(start, end);
  if (jenis === 'KELUAR' || jenis === 'OUT') return getAdminItOutboundCandidates_(start, end);
  throw new Error('Jenis transaksi harus MASUK atau KELUAR.');
}

function getAdminItInboundCandidates_(start, end) {
  const sheet = ensureConfiguredSheetByKey_('barangMasuk');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.barangMasuk.length).getValues();
  const rows = [];
  values.forEach(function(row, idx) {
    const tanggal = row[1] || row[0];
    if (!tanggal) return;
    const tanggalObj = toDate_(tanggal);
    if (tanggalObj < start || tanggalObj > end) return;

    rows.push({
      rowId: 'IN|' + (idx + 2),
      tipe: 'MASUK',
      rowNumber: idx + 2,
      tanggal: dateDisplay_(tanggal),
      timestampInput: dateTimeDisplay_(row[0]),
      referensi: clean_(row[9]),
      kodeNama: clean_(row[8]),
      namaBarang: clean_(row[4]),
      qty: row[5],
      satuan: clean_(row[6]),
      status: clean_(row[7]),
      lokasi: clean_(row[10]),
      nomorITTerima: clean_(row[15]),
      nomorITKirim: clean_(row[11]),
      keterangan: clean_(row[12]),
      userTransaksi: clean_(row[14])
    });
  });

  rows.sort(function(a, b) {
    return String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.referensi).localeCompare(String(b.referensi)) || a.rowNumber - b.rowNumber;
  });
  return rows.slice(0, 300);
}

function getAdminItOutboundCandidates_(start, end) {
  const sheet = ensureConfiguredSheetByKey_('barangKeluar');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.barangKeluar.length).getValues();
  const groups = {};
  values.forEach(function(row, idx) {
    const tanggal = row[1] || row[0];
    if (!tanggal) return;
    const tanggalObj = toDate_(tanggal);
    if (tanggalObj < start || tanggalObj > end) return;

    const key = [
      dateKeySafe_(tanggal), normalizeKey_(row[11]), normalizeKey_(row[2]), normalizeKey_(row[4]), normalizeKey_(row[12])
    ].join('|');

    if (!groups[key]) {
      groups[key] = {
        rowId: 'OUT|' + (idx + 2),
        tipe: 'KELUAR',
        rowNumber: idx + 2,
        rowNumbers: [],
        tanggal: dateDisplay_(tanggal),
        timestampInput: dateTimeDisplay_(row[0]),
        referensi: clean_(row[11]),
        kodeNama: clean_(row[2]) + ' - ' + clean_(row[3]),
        namaBarang: '',
        qty: 0,
        satuan: 'Qty',
        status: '',
        lokasi: clean_(row[4]),
        nomorITTerima: '',
        nomorITKirim: clean_(row[12]),
        keterangan: clean_(row[18]),
        userTransaksi: clean_(row[19]),
        nopol: clean_(row[4]),
        jumlahBaris: 0,
        itemMap: {}
      };
    }

    const group = groups[key];
    group.rowNumbers.push(idx + 2);
    group.qty += toNumber_(row[8]);
    group.jumlahBaris += 1;
    const itemName = clean_(row[7]);
    if (itemName) group.itemMap[itemName] = true;
    if (!group.nomorITKirim && clean_(row[12])) group.nomorITKirim = clean_(row[12]);
  });

  const rows = Object.keys(groups).map(function(key) {
    const item = groups[key];
    item.rowId = 'OUT|' + item.rowNumbers.join(',');
    const itemNames = Object.keys(item.itemMap);
    item.namaBarang = itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? ' +' + (itemNames.length - 3) + ' item' : '');
    item.rowTransaksi = item.rowNumbers.join(',');
    delete item.itemMap;
    return item;
  }).sort(function(a, b) {
    return String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.referensi).localeCompare(String(b.referensi));
  });

  return rows.slice(0, 300);
}

function saveAdminItTransactionLinks(data) {
  data = data || {};
  const login = validateAuth_(data.auth, 'adminIt');
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (!rows.length) throw new Error('Tidak ada nomor IT yang akan disimpan.');

  const now = new Date();
  const logRows = [];
  let updated = 0;

  rows.forEach(function(item, idx) {
    item = item || {};
    const rowId = clean_(item.rowId);
    const tipe = normalizeKey_(item.tipe || item.jenisTransaksi);
    if (!rowId) throw new Error('Baris ' + (idx + 1) + ': ID transaksi tidak ditemukan.');

    if (tipe === 'MASUK' || rowId.indexOf('IN|') === 0) {
      const nomorITTerima = clean_(item.nomorITTerima);
      if (!nomorITTerima) return;
      const info = updateInboundItLink_(rowId, nomorITTerima, now, login.namaUser);
      updated += info.updated;
      logRows.push([
        now, info.tanggalIT, 'TERIMA', nomorITTerima, '', info.referensi, info.kodeNama,
        info.namaBarang, info.qty, clean_(item.catatan), clean_(login.namaUser),
        'BARANG_MASUK', String(info.rowNumber), info.message
      ]);
    } else if (tipe === 'KELUAR' || rowId.indexOf('OUT|') === 0) {
      const nomorITKirim = clean_(item.nomorITKirim);
      if (!nomorITKirim) return;
      const info = updateOutboundItLink_(rowId, nomorITKirim, now, login.namaUser);
      updated += info.updated;
      logRows.push([
        now, info.tanggalIT, 'KIRIM', '', nomorITKirim, info.referensi, info.kodeNama,
        info.namaBarang, info.qty, clean_(item.catatan), clean_(login.namaUser),
        'BARANG_KELUAR', String(info.rowNumbers.join(',')), info.message
      ]);
    } else {
      throw new Error('Baris ' + (idx + 1) + ': Jenis transaksi tidak dikenali.');
    }
  });

  if (!updated) throw new Error('Tidak ada nomor IT yang diisi untuk disimpan.');

  const adminSheet = ensureAdminItSheet_();
  if (logRows.length) {
    adminSheet.getRange(adminSheet.getLastRow() + 1, 1, logRows.length, CONFIG.headers.adminIt.length).setValues(logRows);
  }

  return {
    ok: true,
    updated: updated,
    message: 'Nomor IT berhasil direlasikan ke database transaksi. Total update: ' + updated + ' baris. Disimpan oleh: ' + login.namaUser
  };
}

function parseAdminItRowIds_(rowId, expectedPrefix) {
  const parts = String(rowId || '').split('|');
  if (parts.length !== 2 || parts[0] !== expectedPrefix) throw new Error('Format ID transaksi tidak valid: ' + rowId);
  const rows = parts[1].split(',').map(function(x) { return parseInt(x, 10); }).filter(function(n) { return n && n >= 2; });
  if (!rows.length) throw new Error('Nomor baris transaksi tidak valid: ' + rowId);
  return rows;
}

function updateInboundItLink_(rowId, nomorITTerima, now, adminName) {
  const rowNumber = parseAdminItRowIds_(rowId, 'IN')[0];
  const sheet = ensureConfiguredSheetByKey_('barangMasuk');
  if (rowNumber > sheet.getLastRow()) throw new Error('Baris barang masuk tidak ditemukan: ' + rowNumber);

  const row = sheet.getRange(rowNumber, 1, 1, CONFIG.headers.barangMasuk.length).getValues()[0];
  setCellByHeader_(sheet, rowNumber, 'Nomor IT Terima', nomorITTerima);
  setCellByHeader_(sheet, rowNumber, 'Tanggal Update IT Terima', now);
  setCellByHeader_(sheet, rowNumber, 'Admin Update IT Terima', adminName);

  const info = {
    tanggalIT: row[1] || row[0] || now,
    referensi: clean_(row[9]),
    kodeNama: clean_(row[8]),
    namaBarang: clean_(row[4]),
    qty: row[5],
    satuan: clean_(row[6]),
    rowNumber: rowNumber
  };

  const stockUpdated = updateStockItTerimaByInbound_(info, nomorITTerima, now, adminName);
  const mutasiUpdated = updateMutasiItTerimaByInbound_(info, nomorITTerima, now, adminName);
  info.updated = 1;
  info.message = 'OK: BARANG_MASUK row ' + rowNumber + ', STOCK update ' + stockUpdated + ', MUTASI update ' + mutasiUpdated;
  return info;
}

function updateOutboundItLink_(rowId, nomorITKirim, now, adminName) {
  const rowNumbers = parseAdminItRowIds_(rowId, 'OUT');
  const sheet = ensureConfiguredSheetByKey_('barangKeluar');
  const lastRow = sheet.getLastRow();
  const touched = [];
  let firstRow = null;
  let totalQty = 0;
  const items = {};

  rowNumbers.forEach(function(rowNumber) {
    if (rowNumber > lastRow) return;
    const row = sheet.getRange(rowNumber, 1, 1, CONFIG.headers.barangKeluar.length).getValues()[0];
    if (!firstRow) firstRow = row;
    totalQty += toNumber_(row[8]);
    const itemName = clean_(row[7]);
    if (itemName) items[itemName] = true;

    sheet.getRange(rowNumber, 13).setValue(nomorITKirim);
    setCellByHeader_(sheet, rowNumber, 'Tanggal Update IT Kirim', now);
    setCellByHeader_(sheet, rowNumber, 'Admin Update IT Kirim', adminName);
    touched.push(rowNumber);
  });

  if (!firstRow) throw new Error('Baris barang keluar tidak ditemukan: ' + rowNumbers.join(','));

  const info = {
    tanggalIT: firstRow[1] || firstRow[0] || now,
    referensi: clean_(firstRow[11]),
    kodeNama: clean_(firstRow[2]) + ' - ' + clean_(firstRow[3]),
    namaBarang: Object.keys(items).slice(0, 3).join(', ') + (Object.keys(items).length > 3 ? ' +' + (Object.keys(items).length - 3) + ' item' : ''),
    qty: totalQty,
    rowNumbers: touched
  };

  const otdrUpdated = updateOtdrItKirimByOutbound_(firstRow, nomorITKirim, now, adminName);
  const mutasiUpdated = updateMutasiItKirimByOutbound_(firstRow, nomorITKirim, now, adminName);
  info.updated = touched.length;
  info.message = 'OK: BARANG_KELUAR rows ' + touched.join(',') + ', OTDR update ' + otdrUpdated + ', MUTASI update ' + mutasiUpdated;
  return info;
}

function updateStockItTerimaByInbound_(info, nomorITTerima, now, adminName) {
  const sheet = ensureConfiguredSheetByKey_('stock');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.stock.length).getValues();
  let updated = 0;
  const targetDate = dateKeySafe_(info.tanggalIT);
  values.forEach(function(row, idx) {
    const sameBstb = sameText_(row[10], info.referensi);
    const sameBarang = sameText_(row[1], info.namaBarang);
    const sameTanggal = !targetDate || dateKeySafe_(row[11]) === targetDate;
    if (sameBstb && sameBarang && sameTanggal) {
      const rowNumber = idx + 2;
      setCellByHeader_(sheet, rowNumber, 'Nomor IT Terima Terakhir', nomorITTerima);
      setCellByHeader_(sheet, rowNumber, 'Last Update IT Terima', now);
      setCellByHeader_(sheet, rowNumber, 'Admin IT Terima', adminName);
      updated += 1;
    }
  });
  return updated;
}

function updateMutasiItTerimaByInbound_(info, nomorITTerima, now, adminName) {
  const sheet = ensureConfiguredSheetByKey_('mutasiBarang');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.mutasiBarang.length).getValues();
  let updated = 0;
  const targetDate = dateKeySafe_(info.tanggalIT);
  values.forEach(function(row, idx) {
    const sameJenis = sameText_(row[1], 'IN');
    const sameBstb = sameText_(row[13], info.referensi);
    const sameBarang = sameText_(row[3], info.namaBarang);
    const sameTanggal = !targetDate || dateKeySafe_(row[2]) === targetDate;
    if (sameJenis && sameBstb && sameBarang && sameTanggal) {
      const rowNumber = idx + 2;
      setCellByHeader_(sheet, rowNumber, 'Nomor IT Terima', nomorITTerima);
      setCellByHeader_(sheet, rowNumber, 'Timestamp Update IT', now);
      setCellByHeader_(sheet, rowNumber, 'Admin Update IT', adminName);
      updated += 1;
    }
  });
  return updated;
}

function updateOtdrItKirimByOutbound_(outRow, nomorITKirim, now, adminName) {
  const sheet = ensureConfiguredSheetByKey_('otdr');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.otdr.length).getValues();
  let updated = 0;
  values.forEach(function(row, idx) {
    const sameSj = sameText_(row[6], outRow[11]);
    const sameKode = sameText_(row[4], outRow[2]);
    const sameNopol = sameText_(row[8], outRow[4]);
    if (sameSj && sameKode && sameNopol) {
      const rowNumber = idx + 2;
      sheet.getRange(rowNumber, 2).setValue(now);
      sheet.getRange(rowNumber, 8).setValue(nomorITKirim);
      sheet.getRange(rowNumber, 20).setValue(adminName);
      updated += 1;
    }
  });
  return updated;
}

function updateMutasiItKirimByOutbound_(outRow, nomorITKirim, now, adminName) {
  const sheet = ensureConfiguredSheetByKey_('mutasiBarang');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.mutasiBarang.length).getValues();
  let updated = 0;
  const targetDate = dateKeySafe_(outRow[1] || outRow[0]);
  values.forEach(function(row, idx) {
    const sameJenis = sameText_(row[1], 'OUT');
    const sameSj = sameText_(row[17], outRow[11]);
    const sameKode = sameText_(row[15], outRow[2]);
    const sameTanggal = !targetDate || dateKeySafe_(row[2]) === targetDate;
    if (sameJenis && sameSj && sameKode && sameTanggal) {
      const rowNumber = idx + 2;
      sheet.getRange(rowNumber, 15).setValue(nomorITKirim);
      setCellByHeader_(sheet, rowNumber, 'Timestamp Update IT', now);
      setCellByHeader_(sheet, rowNumber, 'Admin Update IT', adminName);
      updated += 1;
    }
  });
  return updated;
}



/**
 * FITUR ADMIN PICKING LIST & EDIT BARANG KELUAR
 * - Picking list dibuat berdasarkan Nomor PO, lalu sistem memilih lot/batch FEFO tanpa memotong stock.
 * - Edit barang keluar mengoreksi BARANG_KELUAR + STOCK_ONHAND + OTDR dan mencatat LOG_EDIT_BARANG_KELUAR.
 */
function ensurePickingListSheet_() {
  return ensureConfiguredSheetByKey_('pickingList');
}

function ensureLogEditBarangKeluarSheet_() {
  return ensureConfiguredSheetByKey_('logEditBarangKeluar');
}


function getNaturalRackSortParts_(lokasiRak) {
  const raw = clean_(lokasiRak || '-');
  const upper = raw.toUpperCase();
  const nums = (upper.match(/\d+/g) || []).map(function(n) { return parseInt(n, 10); });
  const prefix = upper.replace(/\d+/g, ' ').replace(/[^A-Z]+/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    raw: upper,
    prefix: prefix,
    nums: nums
  };
}

function compareNaturalRack_(rackA, rackB) {
  const a = getNaturalRackSortParts_(rackA);
  const b = getNaturalRackSortParts_(rackB);
  const prefixCompare = a.prefix.localeCompare(b.prefix);
  if (prefixCompare !== 0) return prefixCompare;

  const maxLen = Math.max(a.nums.length, b.nums.length);
  for (let i = 0; i < maxLen; i++) {
    const av = a.nums[i] === undefined ? -1 : a.nums[i];
    const bv = b.nums[i] === undefined ? -1 : b.nums[i];
    if (av !== bv) return av - bv;
  }
  return a.raw.localeCompare(b.raw);
}

function safeDateTimeValue_(value, emptyLast) {
  if (!value) return emptyLast ? 9999999999999 : 0;
  try {
    const time = toDate_(value).getTime();
    if (!isNaN(time)) return time;
  } catch (err) {}
  const fallback = new Date(value || '').getTime();
  if (!isNaN(fallback)) return fallback;
  return emptyLast ? 9999999999999 : 0;
}

function comparePickingRowsByRackFefo_(a, b) {
  const byPO = normalizeKey_(a.nomorPO).localeCompare(normalizeKey_(b.nomorPO));
  if (byPO !== 0) return byPO;

  const byTanggalMuat = safeDateTimeValue_(a.tanggalMuatRaw, false) - safeDateTimeValue_(b.tanggalMuatRaw, false);
  if (byTanggalMuat !== 0) return byTanggalMuat;

  // Untuk picker, jalur ambil dibuat mengikuti nomor rak dulu agar tidak bolak-balik gudang.
  const byRack = compareNaturalRack_(a.lokasiRak, b.lokasiRak);
  if (byRack !== 0) return byRack;

  // Di rak yang sama, tetap FEFO: tanggal expired terdekat diprioritaskan.
  const byExpired = safeDateTimeValue_(a.tanggalExpiredRaw, true) - safeDateTimeValue_(b.tanggalExpiredRaw, true);
  if (byExpired !== 0) return byExpired;

  const byItem = normalizeKey_(a.namaBarang).localeCompare(normalizeKey_(b.namaBarang));
  if (byItem !== 0) return byItem;

  const byProduksi = safeDateTimeValue_(a.tanggalProduksiRaw, true) - safeDateTimeValue_(b.tanggalProduksiRaw, true);
  if (byProduksi !== 0) return byProduksi;

  const byBatch = normalizeKey_(a.nomorBatch).localeCompare(normalizeKey_(b.nomorBatch));
  if (byBatch !== 0) return byBatch;
  return String(a.idStock || '').localeCompare(String(b.idStock || ''));
}

function validateAdminOpsAccess_(auth) {
  return validateAuth_(auth, 'adminIt');
}

function createPickingListFromPO(data) {
  data = data || {};
  const login = validateAdminOpsAccess_(data.auth);
  validateRequired_(data, ['nomorPO', 'tanggalMuat']);

  const nomorPO = clean_(data.nomorPO);
  const nomorSuratJalan = clean_(data.nomorSuratJalan);
  const catatan = clean_(data.catatan);
  const resto = data.restoId ? getRestoById_(data.restoId) : null;
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) throw new Error('Minimal isi 1 item PO untuk dibuatkan picking list.');

  const validOutputs = [];
  items.forEach(function(item, idx) {
    item = item || {};
    const namaBarang = clean_(item.namaBarang);
    const qtyKeluar = parsePositiveInteger_(item.qtyPO || item.qty || item.qtyKeluar, 'Qty PO baris ' + (idx + 1));
    const satuan = clean_(item.satuan || 'Carton');
    if (!namaBarang) throw new Error('Baris PO ' + (idx + 1) + ': Nama barang wajib diisi.');
    if (!satuan) throw new Error('Baris PO ' + (idx + 1) + ': Satuan wajib diisi.');
    validOutputs.push({
      namaBarang: namaBarang,
      qtyKeluar: qtyKeluar,
      satuan: satuan,
      lokasiRak: '',
      idStock: '',
      nomorBatch: '',
      keterangan: catatan
    });
  });

  const deductionPlan = buildBarangKeluarDeductionPlan_(validOutputs);
  if (!deductionPlan.operations.length) throw new Error('Tidak ada stock tersedia untuk dibuat picking list.');

  const sheet = ensurePickingListSheet_();
  const now = new Date();
  const values = deductionPlan.operations.map(function(op, opIdx) {
    const idPicking = 'PICK-' + Utilities.getUuid();
    return [
      now,
      nomorPO,
      toDate_(data.tanggalMuat),
      resto ? resto.kode : clean_(data.kodeResto),
      resto ? resto.nama : clean_(data.namaResto),
      resto ? resto.nopol : clean_(data.nopol),
      resto ? resto.sopir : clean_(data.namaSopir),
      nomorSuratJalan,
      clean_(op.namaBarang),
      toNumber_(op.sourceLine.qtyKeluar),
      toNumber_(op.deductQty),
      clean_(op.satuan),
      clean_(op.lokasiRak),
      clean_(op.idStock),
      clean_(op.nomorBatch),
      op.tanggalProduksi || '',
      op.tanggalExpired || '',
      clean_(op.status),
      clean_(op.nomorBSTB),
      'DRAFT PICKING',
      catatan,
      clean_(login.namaUser),
      idPicking,
      '',
      '',
      '',
      ''
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, CONFIG.headers.pickingList.length).setValues(values);
  SpreadsheetApp.flush();
  return {
    ok: true,
    count: values.length,
    nomorPO: nomorPO,
    message: 'Picking list PO ' + nomorPO + ' berhasil dibuat: ' + values.length + ' baris lot/batch FEFO. Stock belum dipotong sampai transaksi Barang Keluar disimpan.'
  };
}

function getPickingListHeaderIndexMap_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.headers.pickingList.length);
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const indexByHeader = {};
  headers.forEach(function(header, idx) {
    const key = headerKey_(header);
    if (key && indexByHeader[key] === undefined) indexByHeader[key] = idx;
  });
  return indexByHeader;
}

function getPickingColIndex_(indexByHeader, aliases, fallbackIndex) {
  aliases = aliases || [];
  for (let i = 0; i < aliases.length; i++) {
    const key = headerKey_(aliases[i]);
    if (indexByHeader[key] !== undefined) return indexByHeader[key];
  }
  return fallbackIndex;
}

function getPickingCell_(rawRow, displayRow, indexByHeader, aliases, fallbackIndex) {
  const idx = getPickingColIndex_(indexByHeader, aliases, fallbackIndex);
  const raw = rawRow[idx];
  const disp = displayRow[idx];
  // Pakai display value untuk teks agar aman dari format tanggal/angka Google Sheet.
  // Namun raw Date tetap disimpan di field *Raw untuk sorting FEFO/tanggal.
  if (raw instanceof Date) return disp || raw;
  if (raw !== null && raw !== undefined && String(raw).trim() !== '') return raw;
  return disp || '';
}

function getPickingCellRaw_(rawRow, displayRow, indexByHeader, aliases, fallbackIndex) {
  const idx = getPickingColIndex_(indexByHeader, aliases, fallbackIndex);
  const raw = rawRow[idx];
  const disp = displayRow[idx];
  return (raw !== null && raw !== undefined && String(raw).trim() !== '') ? raw : (disp || '');
}

function pickingDisplayDate_(rawValue, displayValue) {
  if (displayValue && String(displayValue).trim()) return String(displayValue).trim();
  return dateDisplay_(rawValue);
}

function mapPickingListRow_(rawRow, displayRow, idx, indexByHeader) {
  const timestampRaw = getPickingCellRaw_(rawRow, displayRow, indexByHeader, ['Timestamp Buat', 'Timestamp Create', 'Timestamp'], 0);
  const tanggalMuatRaw = getPickingCellRaw_(rawRow, displayRow, indexByHeader, ['Tanggal Muat', 'Tanggal Dimuat'], 2);
  const tanggalProduksiRaw = getPickingCellRaw_(rawRow, displayRow, indexByHeader, ['Tanggal Produksi', 'Produksi'], 15);
  const tanggalExpiredRaw = getPickingCellRaw_(rawRow, displayRow, indexByHeader, ['Tanggal Expired', 'Expired', 'Exp'], 16);

  return {
    rowNumber: idx + 2,
    timestampBuatRaw: timestampRaw,
    timestampBuat: dateTimeDisplay_(timestampRaw),
    nomorPO: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nomor PO', 'No PO', 'PO'], 1)),
    tanggalMuatRaw: tanggalMuatRaw,
    tanggalMuat: pickingDisplayDate_(tanggalMuatRaw, displayRow[getPickingColIndex_(indexByHeader, ['Tanggal Muat', 'Tanggal Dimuat'], 2)]),
    kodeResto: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Kode Resto', 'Kode Tujuan'], 3)),
    namaResto: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nama Resto', 'Tujuan', 'Nama Tujuan'], 4)),
    nopol: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nopol', 'No Polisi'], 5)),
    namaSopir: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nama Sopir', 'Sopir'], 6)),
    nomorSuratJalan: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nomor Surat Jalan', 'No Surat Jalan', 'SJ', 'DO'], 7)),
    namaBarang: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nama Barang', 'Barang', 'Item'], 8)),
    qtyPO: toNumber_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Qty PO', 'Quantity PO', 'Qty Order'], 9)),
    qtyPick: toNumber_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Qty Pick', 'Quantity Pick', 'Qty Ambil'], 10)),
    satuan: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Satuan', 'UOM'], 11)),
    lokasiRak: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Lokasi Rak', 'Nomor Rak', 'Rak'], 12)),
    idStock: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['ID Stock', 'Id Stock'], 13)),
    nomorBatch: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nomor Batch', 'No Batch', 'Batch'], 14)),
    tanggalProduksiRaw: tanggalProduksiRaw,
    tanggalProduksi: pickingDisplayDate_(tanggalProduksiRaw, displayRow[getPickingColIndex_(indexByHeader, ['Tanggal Produksi', 'Produksi'], 15)]),
    tanggalExpiredRaw: tanggalExpiredRaw,
    tanggalExpired: pickingDisplayDate_(tanggalExpiredRaw, displayRow[getPickingColIndex_(indexByHeader, ['Tanggal Expired', 'Expired', 'Exp'], 16)]),
    statusStock: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Status Stock', 'Status'], 17)),
    nomorBSTB: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Nomor BSTB', 'No BSTB', 'BSTB'], 18)),
    statusPicking: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Status Picking'], 19)),
    catatan: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Catatan', 'Keterangan'], 20)),
    dibuatOleh: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Dibuat Oleh', 'User', 'Nama User'], 21)),
    idPicking: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['ID Picking', 'Id Picking'], 22)),
    idOtdr: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['ID OTDR', 'Id OTDR'], 23)),
    rowBarangKeluar: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Row Barang Keluar', 'Baris Barang Keluar'], 24)),
    timestampBarangKeluar: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['Timestamp Barang Keluar', 'Tanggal Barang Keluar'], 25)),
    userBarangKeluar: clean_(getPickingCell_(rawRow, displayRow, indexByHeader, ['User Barang Keluar', 'Dikeluarkan Oleh'], 26))
  };
}

function readPickingListRows_() {
  // Backend riwayat picking list harus membaca langsung dari sheet PICKING_LIST.
  // Versi ini memakai raw value + display value + pencocokan header, jadi tetap aman
  // walaupun format tanggal Google Sheet tampil sebagai dd/MM/yyyy atau kolom pernah bergeser.
  const ss = getInventorySpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.sheets.pickingList);
  if (!sheet) throw new Error('Sheet ' + CONFIG.sheets.pickingList + ' tidak ditemukan. Jalankan setupInventorySystem() terlebih dahulu.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const width = Math.max(sheet.getLastColumn(), CONFIG.headers.pickingList.length);
  const indexByHeader = getPickingListHeaderIndexMap_(sheet);
  const rawValues = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();

  const rows = [];
  rawValues.forEach(function(rawRow, idx) {
    const displayRow = displayValues[idx] || [];
    const item = mapPickingListRow_(rawRow, displayRow, idx, indexByHeader);
    if (item.nomorPO || item.namaBarang || item.idStock || item.nomorBatch || item.lokasiRak) rows.push(item);
  });
  return rows;
}

function pickingDateMatches_(item, startValue, endValue) {
  if (!startValue && !endValue) return true;
  // Jika tanggal di sheet sulit diparse, jangan sembunyikan data. Keyword/PO tetap prioritas.
  return isDateInRangeByKey_(item.tanggalMuatRaw || item.tanggalMuat || item.timestampBuatRaw || item.timestampBuat, startValue, endValue);
}

function pickingPoOrKeywordMatches_(item, keywordRaw) {
  const keyword = clean_(keywordRaw || '');
  if (!keyword) return true;
  if (samePoKey_(item.nomorPO, keyword)) return true;
  return pickingKeywordMatches_(item, keyword);
}

function filterPickingRowsForAdmin_(allRows, filter) {
  filter = filter || {};
  const startValue = clean_(filter.startDate || '');
  const endValue = clean_(filter.endDate || '');
  const keywordRaw = clean_(filter.keyword || filter.nomorPO || '');

  let rows = allRows.slice();

  // PO/keyword adalah filter utama. Ini mencegah data di sheet jadi 0 hanya karena format tanggal.
  if (keywordRaw) {
    const keywordRows = rows.filter(function(item) { return pickingPoOrKeywordMatches_(item, keywordRaw); });
    const keywordDateRows = keywordRows.filter(function(item) { return pickingDateMatches_(item, startValue, endValue); });
    return keywordDateRows.length ? keywordDateRows : keywordRows;
  }

  // Tanpa keyword, baru pakai tanggal. Jika tanggal kosong, semua riwayat muncul.
  rows = rows.filter(function(item) { return pickingDateMatches_(item, startValue, endValue); });
  return rows;
}

function getPickingListAdmin(filter) {
  filter = filter || {};
  validateAdminOpsAccess_(filter.auth);

  const allRows = readPickingListRows_();
  const rows = filterPickingRowsForAdmin_(allRows, filter);

  rows.sort(function(a, b) {
    const ta = safeDateTimeValue_(a.tanggalMuatRaw || a.tanggalMuat || a.timestampBuatRaw || a.timestampBuat, false);
    const tb = safeDateTimeValue_(b.tanggalMuatRaw || b.tanggalMuat || b.timestampBuatRaw || b.timestampBuat, false);
    if (tb !== ta) return tb - ta;
    const po = normalizeKey_(a.nomorPO).localeCompare(normalizeKey_(b.nomorPO));
    if (po !== 0) return po;
    return comparePickingRowsByRackFefo_(a, b);
  });

  // Jangan return object Date mentah ke google.script.run. Beberapa browser/webapp bisa gagal serialisasi.
  return rows.slice(0, 1000).map(function(item) {
    const copy = Object.assign({}, item);
    delete copy.timestampBuatRaw;
    delete copy.tanggalMuatRaw;
    delete copy.tanggalProduksiRaw;
    delete copy.tanggalExpiredRaw;
    return copy;
  });
}

function getPickingListPrintData(filter) {
  filter = filter || {};
  validateAdminOpsAccess_(filter.auth);

  const allRows = readPickingListRows_();
  if (!allRows.length) throw new Error('Belum ada data picking list di sheet PICKING_LIST untuk dicetak.');

  const startValue = clean_(filter.startDate || '');
  const endValue = clean_(filter.endDate || '');
  const nomorPORaw = clean_(filter.nomorPO || '');
  const keywordRaw = clean_(filter.keyword || filter.nomorPO || '');

  let rows;
  if (nomorPORaw) {
    const exactPoRows = allRows.filter(function(item) { return samePoKey_(item.nomorPO, nomorPORaw); });
    const keywordPoRows = exactPoRows.length ? exactPoRows : allRows.filter(function(item) { return pickingPoOrKeywordMatches_(item, nomorPORaw); });
    const keywordDateRows = keywordPoRows.filter(function(item) { return pickingDateMatches_(item, startValue, endValue); });
    rows = keywordDateRows.length ? keywordDateRows : keywordPoRows;
  } else if (keywordRaw) {
    const keywordRows = allRows.filter(function(item) { return pickingPoOrKeywordMatches_(item, keywordRaw); });
    const keywordDateRows = keywordRows.filter(function(item) { return pickingDateMatches_(item, startValue, endValue); });
    rows = keywordDateRows.length ? keywordDateRows : keywordRows;
  } else {
    rows = allRows.filter(function(item) { return pickingDateMatches_(item, startValue, endValue); });
  }

  if (!rows.length) {
    throw new Error('Tidak ada picking list sesuai PO/filter yang dipilih. Total data di PICKING_LIST: ' + allRows.length + ' baris. Coba kosongkan tanggal lalu isi Nomor PO, contoh: po16a.');
  }

  // Print harus sesuai request: urut nomor rak, lalu FEFO tanggal expired.
  rows.sort(comparePickingRowsByRackFefo_);

  const first = rows[0];
  const totalQtyPick = rows.reduce(function(sum, item) { return sum + toNumber_(item.qtyPick); }, 0);
  const itemMap = {};
  rows.forEach(function(item) {
    const key = normalizeKey_(item.namaBarang) + '|' + normalizeKey_(item.satuan);
    if (!itemMap[key]) {
      itemMap[key] = {
        namaBarang: item.namaBarang,
        satuan: item.satuan,
        qtyPO: 0,
        qtyPick: 0,
        jumlahLot: 0,
        jumlahRak: {},
        statusQty: 'TERPENUHI'
      };
    }
    itemMap[key].qtyPick += toNumber_(item.qtyPick);
    itemMap[key].qtyPO = Math.max(itemMap[key].qtyPO, toNumber_(item.qtyPO));
    itemMap[key].jumlahLot += 1;
    if (item.lokasiRak) itemMap[key].jumlahRak[normalizeKey_(item.lokasiRak)] = true;
  });

  const summaryItems = Object.keys(itemMap).map(function(key) {
    const item = itemMap[key];
    item.jumlahRak = Object.keys(item.jumlahRak).length;
    item.statusQty = item.qtyPick >= item.qtyPO ? 'TERPENUHI' : 'KURANG';
    return item;
  }).sort(function(a, b) {
    return normalizeKey_(a.namaBarang).localeCompare(normalizeKey_(b.namaBarang));
  });
  const totalQtyPO = summaryItems.reduce(function(sum, item) { return sum + toNumber_(item.qtyPO); }, 0);

  const rackMap = {};
  rows.forEach(function(item) {
    const rack = clean_(item.lokasiRak || '-');
    const key = normalizeKey_(rack || '-');
    if (!rackMap[key]) {
      rackMap[key] = { lokasiRak: rack, totalQtyPick: 0, jumlahLot: 0, jumlahItem: {} };
    }
    rackMap[key].totalQtyPick += toNumber_(item.qtyPick);
    rackMap[key].jumlahLot += 1;
    rackMap[key].jumlahItem[normalizeKey_(item.namaBarang)] = true;
  });
  const rackGroups = Object.keys(rackMap).map(function(key) {
    const rack = rackMap[key];
    rack.jumlahItem = Object.keys(rack.jumlahItem).length;
    return rack;
  }).sort(function(a, b) {
    return compareNaturalRack_(a.lokasiRak, b.lokasiRak);
  });

  const cleanRows = rows.map(function(item) {
    const copy = Object.assign({}, item);
    delete copy.timestampBuatRaw;
    delete copy.tanggalMuatRaw;
    delete copy.tanggalProduksiRaw;
    delete copy.tanggalExpiredRaw;
    return copy;
  });

  return {
    ok: true,
    generatedAt: dateTimeDisplay_(new Date()),
    sortMode: 'NOMOR RAK + FEFO',
    nomorPO: first.nomorPO || nomorPORaw || keywordRaw || '-',
    tanggalMuat: first.tanggalMuat,
    kodeResto: first.kodeResto,
    namaResto: first.namaResto,
    nopol: first.nopol,
    namaSopir: first.namaSopir,
    nomorSuratJalan: first.nomorSuratJalan,
    catatan: first.catatan,
    totalRows: cleanRows.length,
    totalQtyPO: totalQtyPO,
    totalQtyPick: totalQtyPick,
    summaryItems: summaryItems,
    rackGroups: rackGroups,
    rows: cleanRows
  };
}

function isPickingReleasedStatus_(status) {
  const key = normalizeKey_(status);
  return key.indexOf('BARANG KELUAR') >= 0 || key.indexOf('TERELASI') >= 0 || key.indexOf('SELESAI') >= 0 || key === 'DONE' || key === 'COMPLETE' || key === 'CLOSED';
}

function resolveRestoFromPickingRow_(item) {
  const kode = clean_(item.kodeResto);
  if (!kode) throw new Error('Kode Resto pada picking list kosong. Lengkapi tujuan/resto sebelum dibuat Barang Keluar. Row PICKING_LIST: ' + item.rowNumber);

  const nopol = clean_(item.nopol);
  const nama = clean_(item.namaResto);
  const sopir = clean_(item.namaSopir);
  const candidates = readRestoDb_().filter(function(resto) { return sameText_(resto.kode, kode); });

  let match = candidates.find(function(resto) {
    return (!nopol || sameText_(resto.nopol, nopol)) && (!sopir || sameText_(resto.sopir, sopir));
  }) || candidates.find(function(resto) {
    return !nama || sameText_(resto.nama, nama);
  }) || candidates[0];

  if (match) return match;
  // Fallback aman bila DATABASE_RESTO belum lengkap tetapi picking list sudah menyimpan identitas tujuan.
  return {
    id: '',
    rowNumber: 0,
    kode: kode,
    nama: nama,
    nopol: nopol,
    wa: '',
    sopir: sopir,
    keterangan: 'Fallback dari PICKING_LIST'
  };
}

function getBarangKeluarHeaderIndexMap_() {
  const sheet = ensureConfiguredSheetByKey_('barangKeluar');
  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.headers.barangKeluar.length);
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const indexByHeader = {};
  headers.forEach(function(header, idx) {
    const key = headerKey_(header);
    if (key && indexByHeader[key] === undefined) indexByHeader[key] = idx;
  });
  return { sheet: sheet, indexByHeader: indexByHeader, width: lastCol };
}

function readBarangKeluarPickingReleaseMap_() {
  const info = getBarangKeluarHeaderIndexMap_();
  const sheet = info.sheet;
  const lastRow = sheet.getLastRow();
  const map = { idPicking: {}, rowPicking: {}, po: {} };
  if (lastRow < 2) return map;

  const idxPo = info.indexByHeader[headerKey_('Nomor PO')];
  const idxIdPicking = info.indexByHeader[headerKey_('ID Picking')];
  const idxRowPicking = info.indexByHeader[headerKey_('Row Picking List')];
  const values = sheet.getRange(2, 1, lastRow - 1, info.width).getValues();
  values.forEach(function(row) {
    const po = idxPo === undefined ? '' : clean_(row[idxPo]);
    const idPicking = idxIdPicking === undefined ? '' : clean_(row[idxIdPicking]);
    const rowPicking = idxRowPicking === undefined ? '' : clean_(row[idxRowPicking]);
    if (po) map.po[normalizePoKey_(po)] = true;
    if (idPicking) map.idPicking[normalizeKey_(idPicking)] = true;
    if (rowPicking) map.rowPicking[String(rowPicking)] = true;
  });
  return map;
}

function getPickingStatusColumnInfo_() {
  const sheet = ensurePickingListSheet_();
  const indexByHeader = getPickingListHeaderIndexMap_(sheet);
  return {
    sheet: sheet,
    statusCol: getPickingColIndex_(indexByHeader, ['Status Picking'], 19) + 1,
    idPickingCol: getPickingColIndex_(indexByHeader, ['ID Picking', 'Id Picking'], 22) + 1,
    idOtdrCol: getPickingColIndex_(indexByHeader, ['ID OTDR', 'Id OTDR'], 23) + 1,
    rowBarangKeluarCol: getPickingColIndex_(indexByHeader, ['Row Barang Keluar', 'Baris Barang Keluar'], 24) + 1,
    timestampBarangKeluarCol: getPickingColIndex_(indexByHeader, ['Timestamp Barang Keluar', 'Tanggal Barang Keluar'], 25) + 1,
    userBarangKeluarCol: getPickingColIndex_(indexByHeader, ['User Barang Keluar', 'Dikeluarkan Oleh'], 26) + 1
  };
}

function updatePickingRowsAfterBarangKeluar_(selectedRows, detailRows, otdrId, login) {
  const info = getPickingStatusColumnInfo_();
  const now = new Date();
  const outRowsByPickingRow = {};
  (detailRows || []).forEach(function(detail) {
    const rowKey = clean_(detail.rowPickingList);
    if (!rowKey) return;
    if (!outRowsByPickingRow[rowKey]) outRowsByPickingRow[rowKey] = [];
    if (detail.rowBarangKeluar) outRowsByPickingRow[rowKey].push(detail.rowBarangKeluar);
  });

  selectedRows.forEach(function(item) {
    const rowNumber = Number(item.rowNumber);
    if (!rowNumber || rowNumber < 2) return;
    const idPicking = clean_(item.idPicking) || ('PICK-ROW-' + rowNumber);
    const outRows = outRowsByPickingRow[String(rowNumber)] || [];
    info.sheet.getRange(rowNumber, info.statusCol).setValue('SUDAH BARANG KELUAR');
    info.sheet.getRange(rowNumber, info.idPickingCol).setValue(idPicking);
    info.sheet.getRange(rowNumber, info.idOtdrCol).setValue(otdrId);
    info.sheet.getRange(rowNumber, info.rowBarangKeluarCol).setValue(outRows.join(', '));
    info.sheet.getRange(rowNumber, info.timestampBarangKeluarCol).setValue(now);
    info.sheet.getRange(rowNumber, info.userBarangKeluarCol).setValue(clean_(login.namaUser));
  });
}

function submitBarangKeluarFromPickingList(data) {
  data = data || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('NOTICE KOORDINATOR: Ada transaksi barang keluar/picking yang sedang diproses user lain. Tunggu beberapa detik lalu ulangi agar tidak double input.');
  let rollbackSnapshot = null;
  try {
    ensureSystemReady_();
    const login = validateAdminOpsAccess_(data.auth);
    const nomorPO = clean_(data.nomorPO || data.keyword);
    if (!nomorPO) throw new Error('Nomor PO wajib dipilih untuk membuat Barang Keluar dari picking list.');

    const allRows = readPickingListRows_();
    let selectedRows = allRows.filter(function(item) { return samePoKey_(item.nomorPO, nomorPO); });
    if (!selectedRows.length) {
      selectedRows = allRows.filter(function(item) { return pickingPoOrKeywordMatches_(item, nomorPO); });
    }
    selectedRows = selectedRows.filter(function(item) { return toNumber_(item.qtyPick) > 0; });
    if (!selectedRows.length) throw new Error('Tidak ada baris picking list aktif untuk PO/filter: ' + nomorPO + '.');

    selectedRows.sort(comparePickingRowsByRackFefo_);
    const canonicalPO = selectedRows[0].nomorPO || nomorPO;
    const releaseMap = readBarangKeluarPickingReleaseMap_();
    if (releaseMap.po[normalizePoKey_(canonicalPO)]) {
      throw new Error('Picking list PO ' + canonicalPO + ' sudah pernah dibuatkan BARANG_KELUAR. Proses ditolak agar tidak double input.');
    }

    selectedRows.forEach(function(item) {
      const idPicking = clean_(item.idPicking) || ('PICK-ROW-' + item.rowNumber);
      if (isPickingReleasedStatus_(item.statusPicking) || item.idOtdr || item.rowBarangKeluar) {
        throw new Error('Picking list row ' + item.rowNumber + ' / PO ' + item.nomorPO + ' sudah berstatus "' + (item.statusPicking || 'SUDAH TERELASI') + '". Tidak bisa dibuat Barang Keluar lagi.');
      }
      if (releaseMap.idPicking[normalizeKey_(idPicking)] || releaseMap.rowPicking[String(item.rowNumber)]) {
        throw new Error('Picking list row ' + item.rowNumber + ' sudah punya relasi di BARANG_KELUAR. Proses ditolak agar tidak double input.');
      }
    });

    const first = selectedRows[0];
    const resto = resolveRestoFromPickingRow_(first);
    const tanggalMuat = data.tglDimuat || data.tanggalMuat || first.tanggalMuatRaw || first.tanggalMuat;
    const nomorSuratJalan = clean_(data.nomorSuratJalan || first.nomorSuratJalan || canonicalPO);
    const shiftOut = clean_(data.shiftOut || login.namaUser);
    const nomorITKirim = clean_(data.nomorITKirim || '');
    const catatan = clean_(data.keterangan || first.catatan || 'Barang keluar otomatis dari Picking List PO ' + canonicalPO);

    const validOutputs = selectedRows.map(function(item, idx) {
      const idPicking = clean_(item.idPicking) || ('PICK-ROW-' + item.rowNumber);
      const output = {
        namaBarang: clean_(item.namaBarang),
        qtyKeluar: parsePositiveInteger_(item.qtyPick, 'Qty Pick row PICKING_LIST ' + item.rowNumber),
        satuan: clean_(item.satuan),
        lokasiRak: clean_(item.lokasiRak),
        idStock: clean_(item.idStock),
        nomorBatch: clean_(item.nomorBatch),
        keterangan: catatan,
        nomorPO: clean_(item.nomorPO || canonicalPO),
        idPicking: idPicking,
        rowPickingList: String(item.rowNumber)
      };
      if (!output.namaBarang) throw new Error('Row PICKING_LIST ' + item.rowNumber + ': Nama Barang kosong.');
      if (!output.satuan) throw new Error('Row PICKING_LIST ' + item.rowNumber + ': Satuan kosong.');
      if (!output.idStock) throw new Error('Row PICKING_LIST ' + item.rowNumber + ': ID Stock kosong. Buat ulang picking list agar relasi lot jelas.');
      return output;
    });

    const totalQty = validOutputs.reduce(function(sum, item) { return sum + toNumber_(item.qtyKeluar); }, 0);
    const dataOut = {
      tglDimuat: tanggalMuat,
      nomorPO: canonicalPO,
      nomorSuratJalan: nomorSuratJalan,
      nomorITKirim: nomorITKirim,
      shiftOut: shiftOut,
      keterangan: catatan,
      namaUserTransaksi: clean_(login.namaUser)
    };

    // Validasi stok dilakukan sebelum ada CRUD. Jika gagal, BARANG_KELUAR/PICKING_LIST/STOCK tidak berubah.
    const deductionPlan = buildBarangKeluarDeductionPlan_(validOutputs);
    rollbackSnapshot = createBarangKeluarRollbackSnapshot_();

    const otdrId = createOrUpdateOtdrDraft_({
      tglDimuat: tanggalMuat,
      resto: resto,
      nomorSuratJalan: nomorSuratJalan,
      nomorITKirim: nomorITKirim,
      totalItem: validOutputs.length,
      totalQty: totalQty,
      keterangan: catatan,
      namaUserTransaksi: clean_(login.namaUser)
    });

    const detail = executeBarangKeluarDeductionPlan_(dataOut, resto, otdrId, deductionPlan);
    updatePickingRowsAfterBarangKeluar_(selectedRows, detail, otdrId, login);

    safeSyncRelasiRakBatch_();
    SpreadsheetApp.flush();
    return {
      ok: true,
      nomorPO: canonicalPO,
      otdrId: otdrId,
      count: selectedRows.length,
      totalQty: totalQty,
      detail: detail,
      message: 'Barang Keluar berhasil dibuat dari Picking List PO ' + canonicalPO + '. Total baris: ' + selectedRows.length + ', total qty: ' + totalQty + '. Relasi ID Picking/Row Picking sudah masuk ke BARANG_KELUAR dan status PICKING_LIST menjadi SUDAH BARANG KELUAR. ID OTDR: ' + otdrId
    };
  } catch (err) {
    if (rollbackSnapshot) {
      try {
        restoreBarangKeluarRollbackSnapshot_(rollbackSnapshot);
        SpreadsheetApp.flush();
      } catch (rollbackErr) {
        throw new Error('Barang keluar dari picking list gagal dan rollback juga gagal. Error utama: ' + (err && err.message ? err.message : err) + '. Error rollback: ' + (rollbackErr && rollbackErr.message ? rollbackErr.message : rollbackErr));
      }
    }
    throw new Error('Barang keluar dari picking list dibatalkan. Database tidak dieksekusi / sudah di-rollback. Detail: ' + (err && err.message ? err.message : err));
  } finally {
    lock.releaseLock();
  }
}

function getBarangKeluarEditList(filter) {
  filter = filter || {};
  validateAdminOpsAccess_(filter.auth);
  const sheet = getSheet_(CONFIG.sheets.barangKeluar);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const start = filter.startDate ? startOfDay_(filter.startDate) : null;
  const end = filter.endDate ? endOfDay_(filter.endDate) : null;
  const keyword = normalizeKey_(filter.keyword || '');

  let rows = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.barangKeluar.length).getValues().map(function(row, idx) {
    return {
      rowNumber: idx + 2,
      timestampInput: dateTimeDisplay_(row[0]),
      tanggalDimuatRaw: row[1],
      tanggalDimuat: dateDisplay_(row[1]),
      kodeResto: clean_(row[2]),
      namaResto: clean_(row[3]),
      nopol: clean_(row[4]),
      namaBarang: clean_(row[7]),
      qtyKeluar: toNumber_(row[8]),
      satuan: clean_(row[9]),
      shiftOut: clean_(row[10]),
      nomorSuratJalan: clean_(row[11]),
      nomorITKirim: clean_(row[12]),
      lokasiRak: clean_(row[13]),
      idStock: clean_(row[14]),
      nomorBSTB: clean_(row[15]),
      tanggalExpired: dateDisplay_(row[16]),
      idOtdr: clean_(row[17]),
      keterangan: clean_(row[18]),
      namaUserTransaksi: clean_(row[19]),
      nomorBatch: clean_(row[22])
    };
  }).filter(function(item) {
    if (start && item.tanggalDimuatRaw && toDate_(item.tanggalDimuatRaw) < start) return false;
    if (end && item.tanggalDimuatRaw && toDate_(item.tanggalDimuatRaw) > end) return false;
    if (!keyword) return true;
    const hay = normalizeKey_([
      item.tanggalDimuat, item.kodeResto, item.namaResto, item.nopol, item.namaBarang,
      item.nomorSuratJalan, item.nomorITKirim, item.idStock, item.nomorBatch,
      item.lokasiRak, item.idOtdr
    ].join(' '));
    return hay.indexOf(keyword) !== -1;
  });

  rows.sort(function(a, b) {
    return new Date(b.tanggalDimuatRaw || 0).getTime() - new Date(a.tanggalDimuatRaw || 0).getTime() || b.rowNumber - a.rowNumber;
  });
  return rows.slice(0, 200);
}

function updateBarangKeluarMismatch(data) {
  data = data || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Ada proses edit barang keluar lain yang sedang berjalan. Coba simpan ulang beberapa detik lagi.');

  let rollbackSnapshot = null;
  try {
    ensureSystemReady_();
    const login = validateAdminOpsAccess_(data.auth);
    const rowNumber = parsePositiveInteger_(data.rowNumber, 'Row barang keluar');
    const rawQtyBaru = String(data.qtyBaru === null || data.qtyBaru === undefined ? '' : data.qtyBaru).trim();
    if (!/^[0-9]+$/.test(rawQtyBaru)) throw new Error('Qty baru harus angka bulat. Tidak boleh menggunakan koma/desimal.');
    const newQty = Number(rawQtyBaru);
    const alasan = clean_(data.alasan || data.catatan);
    if (!alasan) throw new Error('Alasan / catatan edit wajib diisi agar audit jelas.');

    const keluarSheet = getSheet_(CONFIG.sheets.barangKeluar);
    const lastRow = keluarSheet.getLastRow();
    if (rowNumber < 2 || rowNumber > lastRow) throw new Error('Row barang keluar tidak valid.');

    const row = keluarSheet.getRange(rowNumber, 1, 1, CONFIG.headers.barangKeluar.length).getValues()[0];
    const oldQty = toNumber_(row[8]);
    const delta = newQty - oldQty;
    const idStock = clean_(row[14]);
    if (!idStock) throw new Error('ID Stock pada BARANG_KELUAR kosong, edit dibatalkan agar stok tidak selisih.');

    const stockSheet = getSheet_(CONFIG.sheets.stock);
    const stockRows = getStockRows_();
    const stockItem = stockRows.find(function(item) { return sameText_(item.idStock, idStock); });
    if (!stockItem) throw new Error('ID Stock tidak ditemukan di STOCK_ONHAND: ' + idStock);

    const stockQtyKeluarLama = toNumber_(stockItem.qtyKeluar);
    const stockOnhandLama = toNumber_(stockItem.stockOnhand);
    const stockQtyKeluarBaru = stockQtyKeluarLama + delta;
    const stockOnhandBaru = stockOnhandLama - delta;

    if (stockQtyKeluarBaru < 0) throw new Error('Edit ditolak karena Qty Keluar stock akan minus.');
    if (stockOnhandBaru < 0) throw new Error('Edit ditolak karena Stock Onhand tidak cukup untuk tambahan qty. Tersedia: ' + stockOnhandLama + ', tambahan: ' + delta + '.');

    rollbackSnapshot = createAdminOpsRollbackSnapshot_();
    const now = new Date();
    const editNote = '[EDIT ADMIN ' + Utilities.formatDate(now, CONFIG.timezone, 'dd/MM/yyyy HH:mm') + ' oleh ' + login.namaUser + '] Qty ' + oldQty + ' -> ' + newQty + '. Alasan: ' + alasan;
    const ketLama = clean_(row[18]);
    const ketBaru = ketLama ? ketLama + ' | ' + editNote : editNote;

    stockSheet.getRange(stockItem.row, 8, 1, 2).setValues([[stockQtyKeluarBaru, stockOnhandBaru]]);
    stockSheet.getRange(stockItem.row, 14).setValue(now);
    stockSheet.getRange(stockItem.row, 16).setValue(clean_(login.namaUser));

    keluarSheet.getRange(rowNumber, 9).setValue(newQty);
    keluarSheet.getRange(rowNumber, 19).setValue(ketBaru);

    const idOtdr = clean_(row[17]);
    if (idOtdr && delta !== 0) adjustOtdrTotalAfterBarangKeluarEdit_(idOtdr, oldQty, newQty, delta, login.namaUser);

    ensureLogEditBarangKeluarSheet_();
    appendRowByHeader_(CONFIG.sheets.logEditBarangKeluar, 'logEditBarangKeluar', [
      now,
      rowNumber,
      row[1],
      clean_(row[2]),
      clean_(row[3]),
      clean_(row[11]),
      idOtdr,
      clean_(row[7]),
      idStock,
      clean_(row[22]),
      clean_(row[13]),
      oldQty,
      newQty,
      delta,
      stockOnhandBaru,
      alasan,
      clean_(login.namaUser)
    ]);

    if (delta !== 0) {
      logMutasi_({
        jenisMutasi: delta > 0 ? 'KOREKSI OUT TAMBAH' : 'KOREKSI OUT KURANG',
        tanggalTransaksi: new Date(),
        namaBarang: clean_(row[7]),
        tanggalProduksi: stockItem.tanggalProduksi || '',
        tanggalExpired: row[16] || stockItem.tanggalExpired || '',
        status: clean_(stockItem.status),
        lokasiRak: clean_(row[13]),
        qtyMasuk: delta < 0 ? Math.abs(delta) : 0,
        qtyKeluar: delta > 0 ? delta : 0,
        saldoAkhirLot: stockOnhandBaru,
        satuan: clean_(row[9]),
        idStock: idStock,
        nomorBSTB: clean_(row[15]),
        nomorITKirim: clean_(row[12]),
        kodeResto: clean_(row[2]),
        namaResto: clean_(row[3]),
        nomorSuratJalan: clean_(row[11]),
        shiftKoordinator: clean_(row[10]),
        namaUserTransaksi: clean_(login.namaUser),
        keterangan: editNote,
        nomorBatch: clean_(row[22])
      });
    }

    safeSyncRelasiRakBatch_();
    SpreadsheetApp.flush();
    return {
      ok: true,
      message: 'Edit barang keluar berhasil. Qty lama ' + oldQty + ' menjadi ' + newQty + '. Selisih ' + delta + '. Stock onhand ID ' + idStock + ' sekarang ' + stockOnhandBaru + '.'
    };
  } catch (err) {
    if (rollbackSnapshot) {
      try {
        restoreBarangKeluarRollbackSnapshot_(rollbackSnapshot);
        SpreadsheetApp.flush();
      } catch (rollbackErr) {
        throw new Error('Edit barang keluar gagal dan rollback juga gagal. Error utama: ' + (err && err.message ? err.message : err) + '. Error rollback: ' + (rollbackErr && rollbackErr.message ? rollbackErr.message : rollbackErr));
      }
    }
    throw new Error('Edit barang keluar dibatalkan. Database tidak dieksekusi / sudah di-rollback. Detail: ' + (err && err.message ? err.message : err));
  } finally {
    lock.releaseLock();
  }
}

function createAdminOpsRollbackSnapshot_() {
  return ['stock', 'barangKeluar', 'mutasiBarang', 'otdr', 'logEditBarangKeluar', 'pickingList'].map(function(sheetKey) {
    return captureSheetSnapshotForRollback_(sheetKey);
  });
}

function adjustOtdrTotalAfterBarangKeluarEdit_(idOtdr, oldQty, newQty, delta, namaUser) {
  const sheet = getSheet_(CONFIG.sheets.otdr);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.otdr.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!sameText_(row[2], idOtdr)) continue;
    const rowNumber = i + 2;
    let itemDelta = 0;
    if (oldQty > 0 && newQty === 0) itemDelta = -1;
    if (oldQty === 0 && newQty > 0) itemDelta = 1;

    sheet.getRange(rowNumber, 2).setValue(new Date());
    sheet.getRange(rowNumber, 16).setValue(Math.max(0, toNumber_(row[15]) + itemDelta));
    sheet.getRange(rowNumber, 17).setValue(Math.max(0, toNumber_(row[16]) + delta));
    sheet.getRange(rowNumber, 20).setValue(clean_(namaUser));
    const catatan = clean_(row[17]);
    const note = 'Edit barang keluar: qty ' + oldQty + ' -> ' + newQty + ' oleh ' + namaUser;
    sheet.getRange(rowNumber, 18).setValue(catatan ? catatan + ' | ' + note : note);
    return;
  }
}

function normalizeBarangMasukBatches_(data) {
  data = data || {};
  const rawRows = Array.isArray(data.batches) && data.batches.length
    ? data.batches
    : [{ nomorBatch: data.nomorBatch, qty: data.qty, lokasiRak: data.lokasiRak, keterangan: data.keterangan }];

  const rows = [];
  const usedRackBatch = {};

  rawRows.forEach(function(row, idx) {
    row = row || {};
    const hasAny = clean_(row.nomorBatch) || clean_(row.qty) || clean_(row.lokasiRak) || clean_(row.keterangan);
    if (!hasAny) return;

    const nomorBatch = clean_(row.nomorBatch || data.nomorBatch);
    if (!nomorBatch) throw new Error('Nomor Batch barang masuk baris ' + (idx + 1) + ' wajib diisi.');

    const qty = parsePositiveInteger_(row.qty, 'Qty batch barang masuk baris ' + (idx + 1));
    const lokasiRak = clean_(row.lokasiRak || data.lokasiRak);
    if (!lokasiRak) throw new Error('Lokasi Rak batch barang masuk baris ' + (idx + 1) + ' wajib diisi.');

    const rackBatchKey = normalizeKey_(lokasiRak) + '|' + normalizeKey_(nomorBatch);
    if (usedRackBatch[rackBatchKey]) {
      throw new Error('Nomor Batch ' + nomorBatch + ' pada Rak ' + lokasiRak + ' diinput lebih dari 1 baris pada transaksi yang sama. Gabungkan qty batch tersebut dalam 1 baris agar lot tidak double.');
    }
    usedRackBatch[rackBatchKey] = true;

    rows.push({
      nomorBatch: nomorBatch,
      qty: qty,
      lokasiRak: lokasiRak,
      keterangan: clean_(row.keterangan || data.keterangan),
      rowNumber: idx + 1
    });
  });

  if (!rows.length) {
    throw new Error('Minimal isi 1 baris batch barang masuk dengan Qty dan Lokasi Rak.');
  }
  return rows;
}

function summarizeBarangMasukBatches_(batchRows) {
  batchRows = batchRows || [];
  const totalQty = batchRows.reduce(function(sum, item) { return sum + toNumber_(item.qty); }, 0);
  const lokasiList = batchRows.map(function(item) { return item.lokasiRak; }).filter(String);
  const batchList = batchRows.map(function(item) { return item.nomorBatch; }).filter(String);
  return {
    totalQty: totalQty,
    lokasiRakText: lokasiList.join(', '),
    nomorBatchText: batchList.join(', '),
    lineText: batchRows.map(function(item, idx) {
      return (idx + 1) + '. Batch: ' + (item.nomorBatch || '-') + ' | Qty: ' + item.qty + ' | Rak: ' + item.lokasiRak;
    }).join('\n')
  };
}


function submitBarangMasuk(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('NOTICE KOORDINATOR: Ada transaksi barang masuk/keluar yang sedang diproses oleh user lain. Tunggu beberapa detik lalu klik Simpan ulang agar data tidak bertumbukan.');
  }

  let rollbackSnapshot = null;
  try {
    ensureSystemReady_();
    validateRequired_(data, ['tanggalBSTB', 'tanggalProduksi', 'namaBarang', 'satuan', 'status', 'shiftIn', 'nomorBSTB']);

    const login = validateAuth_(data.auth, 'masuk');
    if (!login.access.supervisor) data.shiftIn = login.namaUser;
    data.namaUserTransaksi = login.namaUser;

    const batchRows = normalizeBarangMasukBatches_(data);
    const batchSummary = summarizeBarangMasukBatches_(batchRows);
    data.qty = batchSummary.totalQty;
    data.lokasiRak = batchSummary.lokasiRakText;
    data.nomorBatch = batchSummary.nomorBatchText;

    const noticeResult = buildBarangMasukNotice_(data, login);
    if (noticeResult.notices.length && !isNoticeConfirmed_(data)) {
      logTransactionNotice_('BARANG MASUK', 'BUTUH KONFIRMASI', noticeResult.keyData, noticeResult.message, login.namaUser, 'BELUM DISIMPAN');
      return {
        ok: false,
        needConfirm: true,
        noticeType: 'BARANG_MASUK',
        message: noticeResult.message,
        notices: noticeResult.notices,
        keyData: noticeResult.keyData
      };
    }

    // Mulai versi multi-batch, rak yang masih memiliki stock aktif tetap boleh dipilih.
    // Pembeda utama antar lot adalah kombinasi Rak + Nomor Batch + Barang + Tanggal Produksi/Expired + Status + BSTB + Satuan.

    rollbackSnapshot = createBarangMasukRollbackSnapshot_();

    const now = new Date();
    const jamIn = Utilities.formatDate(now, CONFIG.timezone, 'HH:mm:ss');
    const waktuCSMenit = clean_(data.waktuCSMenit) ? normalizeDurationMinuteSecond_(data.waktuCSMenit, 'Waktu masuk CS') : '';
    const expiredBulan = toNumber_(getExpiredMonthsByBarang_(data.namaBarang) || data.expiredBulan);
    const tanggalExpiredFinal = calculateExpiredDate_(data.tanggalProduksi, expiredBulan);
    const stockSheet = getSheet_(CONFIG.sheets.stock);

    let savedRows = 0;
    let savedQty = 0;

    batchRows.forEach(function(batch) {
      const qty = toNumber_(batch.qty);
      const nomorBatch = clean_(batch.nomorBatch);
      const lokasiRak = clean_(batch.lokasiRak);
      const keteranganBatch = clean_(batch.keterangan || data.keterangan);

      appendRowByHeader_(CONFIG.sheets.barangMasuk, 'barangMasuk', [
        now,
        toDate_(data.tanggalBSTB),
        toDate_(data.tanggalProduksi),
        tanggalExpiredFinal,
        clean_(data.namaBarang),
        qty,
        clean_(data.satuan),
        clean_(data.status),
        clean_(data.shiftIn),
        clean_(data.nomorBSTB),
        lokasiRak,
        clean_(data.nomorITKirim),
        keteranganBatch,
        jamIn,
        clean_(data.namaUserTransaksi),
        '',
        '',
        '',
        nomorBatch,
        waktuCSMenit
      ]);

      const lotKey = makeLotKey_(data.namaBarang, data.tanggalProduksi, tanggalExpiredFinal, data.status, lokasiRak, data.nomorBSTB, data.satuan, nomorBatch);
      const rowInfo = findStockRowByKey_(stockSheet, lotKey);

      if (rowInfo) {
        const row = rowInfo.row;
        const oldQtyMasuk = toNumber_(stockSheet.getRange(row, 7).getValue());
        const oldStock = toNumber_(stockSheet.getRange(row, 9).getValue());
        stockSheet.getRange(row, 7).setValue(oldQtyMasuk + qty);
        stockSheet.getRange(row, 9).setValue(oldStock + qty);
        stockSheet.getRange(row, 13).setValue(clean_(data.nomorITKirim));
        stockSheet.getRange(row, 14).setValue(now);
        stockSheet.getRange(row, 16).setValue(clean_(data.namaUserTransaksi));
        setCellByHeader_(stockSheet, row, 'Nomor Batch', nomorBatch);
      } else {
        appendRowByHeader_(CONFIG.sheets.stock, 'stock', [
          generateStockId_(),
          clean_(data.namaBarang),
          toDate_(data.tanggalProduksi),
          tanggalExpiredFinal,
          clean_(data.status),
          lokasiRak,
          qty,
          0,
          qty,
          clean_(data.satuan),
          clean_(data.nomorBSTB),
          toDate_(data.tanggalBSTB),
          clean_(data.nomorITKirim),
          now,
          lotKey,
          clean_(data.namaUserTransaksi),
          '',
          '',
          '',
          nomorBatch
        ]);
      }

      const stockAfterIn = getStockByLotKey_(lotKey);
      logMutasi_({
        jenisMutasi: 'IN',
        tanggalTransaksi: toDate_(data.tanggalBSTB),
        namaBarang: clean_(data.namaBarang),
        tanggalProduksi: toDate_(data.tanggalProduksi),
        tanggalExpired: tanggalExpiredFinal,
        status: clean_(data.status),
        lokasiRak: lokasiRak,
        qtyMasuk: qty,
        qtyKeluar: 0,
        saldoAkhirLot: stockAfterIn ? stockAfterIn.stockOnhand : qty,
        satuan: clean_(data.satuan),
        idStock: stockAfterIn ? stockAfterIn.idStock : '',
        nomorBSTB: clean_(data.nomorBSTB),
        nomorITKirim: clean_(data.nomorITKirim),
        kodeResto: '',
        namaResto: '',
        nomorSuratJalan: '',
        shiftKoordinator: clean_(data.shiftIn),
        namaUserTransaksi: clean_(data.namaUserTransaksi),
        keterangan: keteranganBatch,
        nomorBatch: nomorBatch
      });

      savedRows += 1;
      savedQty += qty;
    });

    if (noticeResult.notices.length) {
      logTransactionNotice_('BARANG MASUK', 'DIKONFIRMASI USER', noticeResult.keyData, noticeResult.message, login.namaUser, 'TETAP DISIMPAN SETELAH KONFIRMASI');
    }

    safeSyncRelasiRakBatch_();
    SpreadsheetApp.flush();
    return {
      ok: true,
      message: 'Barang masuk berhasil disimpan. Total batch: ' + savedRows + ', total qty: ' + savedQty + ' ' + clean_(data.satuan) + '.',
      totalBatch: savedRows,
      totalQty: savedQty,
      waktuCSMenit: waktuCSMenit,
      batchLines: batchRows
    };
  } catch (err) {
    if (rollbackSnapshot) {
      try {
        restoreBarangKeluarRollbackSnapshot_(rollbackSnapshot);
        SpreadsheetApp.flush();
      } catch (rollbackErr) {
        throw new Error('Barang masuk gagal dan rollback juga gagal. Cek database manual. Error utama: ' + (err && err.message ? err.message : err) + '. Error rollback: ' + (rollbackErr && rollbackErr.message ? rollbackErr.message : rollbackErr));
      }
    }
    throw new Error('Barang masuk dibatalkan. Database tidak dieksekusi / sudah di-rollback. Detail: ' + (err && err.message ? err.message : err));
  } finally {
    lock.releaseLock();
  }
}

function submitBarangKeluarBatch(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('NOTICE KOORDINATOR: Ada transaksi barang masuk/keluar yang sedang diproses oleh user lain. Tunggu beberapa detik lalu klik Simpan ulang agar data tidak bertumbukan.');
  let rollbackSnapshot = null;
  try {
    ensureSystemReady_();
    validateRequired_(data, ['tglDimuat', 'restoId', 'shiftOut', 'nomorSuratJalan']);
    const login = validateAuth_(data.auth, 'keluar');
    if (!login.access.supervisor) data.shiftOut = login.namaUser;
    data.namaUserTransaksi = login.namaUser;

    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    if (outputs.length === 0) throw new Error('Minimal tambah 1 output barang keluar.');

    const resto = getRestoById_(data.restoId);
    if (!resto) throw new Error('Kode Resto tidak ditemukan di DATABASE_RESTO.');

    let totalQty = 0;
    const validOutputs = outputs.map(function(line, idx) {
      const item = {
        namaBarang: clean_(line.namaBarang),
        qtyKeluar: parsePositiveInteger_(line.qtyKeluar, 'Qty keluar baris ' + (idx + 1)),
        satuan: clean_(line.satuan),
        lokasiRak: clean_(line.lokasiRak),
        idStock: clean_(line.idStock),
        nomorBatch: clean_(line.nomorBatch),
        keterangan: clean_(line.keterangan)
      };
      if (!item.namaBarang) throw new Error('Output baris ' + (idx + 1) + ': Nama barang wajib diisi.');
      if (item.qtyKeluar <= 0) throw new Error('Output baris ' + (idx + 1) + ': Qty keluar harus lebih dari 0.');
      if (!item.satuan) throw new Error('Output baris ' + (idx + 1) + ': Satuan wajib diisi.');
      totalQty += item.qtyKeluar;
      return item;
    });

    const noticeResult = buildBarangKeluarNotice_(data, resto, validOutputs, login);
    if (noticeResult.notices.length && !isNoticeConfirmed_(data)) {
      logTransactionNotice_('BARANG KELUAR', 'BUTUH KONFIRMASI', noticeResult.keyData, noticeResult.message, login.namaUser, 'BELUM DISIMPAN');
      return {
        ok: false,
        needConfirm: true,
        noticeType: 'BARANG_KELUAR',
        message: noticeResult.message,
        notices: noticeResult.notices,
        keyData: noticeResult.keyData
      };
    }

    // VALIDASI DULU TANPA CRUD: seluruh output dicek stoknya sampai lolos semua.
    // Kalau ada 1 baris gagal, proses berhenti di sini dan belum ada database yang berubah.
    const deductionPlan = buildBarangKeluarDeductionPlan_(validOutputs);

    // Snapshot dibuat sesaat sebelum penulisan. Jika ada error saat append/update,
    // semua sheet transaksi dikembalikan seperti sebelum klik Simpan.
    rollbackSnapshot = createBarangKeluarRollbackSnapshot_();

    const otdrId = createOrUpdateOtdrDraft_({
      tglDimuat: data.tglDimuat,
      resto: resto,
      nomorSuratJalan: data.nomorSuratJalan,
      nomorITKirim: data.nomorITKirim,
      totalItem: validOutputs.length,
      totalQty: totalQty,
      keterangan: data.keterangan,
      namaUserTransaksi: data.namaUserTransaksi
    });

    const allDetails = executeBarangKeluarDeductionPlan_(data, resto, otdrId, deductionPlan);

    if (noticeResult.notices.length) {
      logTransactionNotice_('BARANG KELUAR', 'DIKONFIRMASI USER', noticeResult.keyData, noticeResult.message, login.namaUser, 'TETAP DISIMPAN SETELAH KONFIRMASI');
    }

    safeSyncRelasiRakBatch_();
    SpreadsheetApp.flush();
    return {
      ok: true,
      message: 'Barang keluar berhasil. Tujuan: ' + resto.kode + ' - ' + resto.nama + '. Tanggal dimuat: ' + dateDisplay_(toDate_(data.tglDimuat)) + '. Total output: ' + validOutputs.length + ' item, total qty: ' + totalQty + '. ID OTDR: ' + otdrId,
      otdrId: otdrId,
      detail: allDetails
    };
  } catch (err) {
    if (rollbackSnapshot) {
      try {
        restoreBarangKeluarRollbackSnapshot_(rollbackSnapshot);
        SpreadsheetApp.flush();
      } catch (rollbackErr) {
        throw new Error('Barang keluar gagal dan rollback juga gagal. Cek database manual. Error utama: ' + (err && err.message ? err.message : err) + '. Error rollback: ' + (rollbackErr && rollbackErr.message ? rollbackErr.message : rollbackErr));
      }
    }
    throw new Error('Barang keluar dibatalkan. Database tidak dieksekusi / sudah di-rollback. Detail: ' + (err && err.message ? err.message : err));
  } finally {
    lock.releaseLock();
  }
}

function buildBarangKeluarDeductionPlan_(validOutputs) {
  const workingRows = getStockRows_().map(function(item) {
    return {
      row: item.row,
      idStock: clean_(item.idStock),
      lotKey: clean_(item.lotKey),
      namaBarang: clean_(item.namaBarang),
      tanggalProduksi: item.tanggalProduksi,
      tanggalExpired: item.tanggalExpired,
      status: clean_(item.status),
      lokasiRak: clean_(item.lokasiRak),
      qtyMasuk: toNumber_(item.qtyMasuk),
      qtyKeluar: toNumber_(item.qtyKeluar),
      stockOnhand: toNumber_(item.stockOnhand),
      satuan: clean_(item.satuan),
      nomorBSTB: clean_(item.nomorBSTB),
      nomorITKirim: clean_(item.nomorITKirim),
      nomorBatch: clean_(item.nomorBatch)
    };
  });

  const operations = [];

  validOutputs.forEach(function(line, lineIndex) {
    const qtyRequest = parsePositiveInteger_(line.qtyKeluar, 'Qty keluar baris ' + (lineIndex + 1));
    let candidates = workingRows.filter(function(item) {
      const sameBarang = sameText_(item.namaBarang, line.namaBarang);
      const sameSatuan = sameText_(item.satuan, line.satuan);
      const available = toNumber_(item.stockOnhand) > 0;

      // Backend tidak boleh hanya bergantung pada lokasi bila user sudah memilih ID Stock/batch.
      // Prioritas identitas lot: ID Stock -> Nomor Batch -> Lokasi -> FEFO umum.
      const sameId = line.idStock ? sameText_(item.idStock, line.idStock) : true;
      const sameBatch = line.nomorBatch ? sameText_(item.nomorBatch, line.nomorBatch) : true;
      const sameLocation = line.lokasiRak ? sameText_(item.lokasiRak, line.lokasiRak) : true;
      return sameBarang && sameSatuan && available && sameId && sameBatch && sameLocation;
    });

    if (candidates.length === 0) {
      throw new Error('Stock tidak tersedia untuk barang: ' + line.namaBarang + '. Tidak ada data yang ditulis ke spreadsheet.');
    }

    // FEFO murni: expired terdekat keluar lebih dulu, lalu produksi terlama, lalu ID Stock.
    candidates.sort(function(a, b) {
      const ad = new Date(a.tanggalExpired).getTime();
      const bd = new Date(b.tanggalExpired).getTime();
      const safeA = isNaN(ad) ? 9999999999999 : ad;
      const safeB = isNaN(bd) ? 9999999999999 : bd;
      if (safeA !== safeB) return safeA - safeB;

      const ap = new Date(a.tanggalProduksi).getTime();
      const bp = new Date(b.tanggalProduksi).getTime();
      const prodA = isNaN(ap) ? 9999999999999 : ap;
      const prodB = isNaN(bp) ? 9999999999999 : bp;
      if (prodA !== prodB) return prodA - prodB;

      return String(a.idStock || '').localeCompare(String(b.idStock || ''));
    });

    const totalAvailable = candidates.reduce(function(sum, item) { return sum + toNumber_(item.stockOnhand); }, 0);
    if (totalAvailable < qtyRequest) {
      throw new Error('Stock tidak cukup untuk ' + line.namaBarang + '. Permintaan: ' + qtyRequest + ', tersedia: ' + totalAvailable + '. Tidak ada data yang ditulis ke spreadsheet.');
    }

    let remaining = qtyRequest;
    candidates.forEach(function(item) {
      if (remaining <= 0) return;

      const availableBefore = toNumber_(item.stockOnhand);
      const qtyKeluarBefore = toNumber_(item.qtyKeluar);
      const deductQty = Math.min(availableBefore, remaining);
      const newQtyKeluar = qtyKeluarBefore + deductQty;
      const newStock = availableBefore - deductQty;

      operations.push({
        sourceLine: line,
        lineIndex: lineIndex,
        row: item.row,
        idStock: item.idStock,
        lotKey: item.lotKey,
        namaBarang: item.namaBarang,
        tanggalProduksi: item.tanggalProduksi,
        tanggalExpired: item.tanggalExpired,
        status: item.status,
        lokasiRak: item.lokasiRak,
        satuan: item.satuan,
        nomorBSTB: item.nomorBSTB,
        nomorBatch: item.nomorBatch,
        oldQtyKeluar: qtyKeluarBefore,
        oldStock: availableBefore,
        deductQty: deductQty,
        newQtyKeluar: newQtyKeluar,
        newStock: newStock
      });

      item.qtyKeluar = newQtyKeluar;
      item.stockOnhand = newStock;
      remaining -= deductQty;
    });
  });

  return { operations: operations };
}

function executeBarangKeluarDeductionPlan_(data, resto, otdrId, deductionPlan) {
  const stockSheet = getSheet_(CONFIG.sheets.stock);
  ensureSheetForWrite_(CONFIG.sheets.barangKeluar, 'barangKeluar');
  ensureSheetForWrite_(CONFIG.sheets.mutasiBarang, 'mutasiBarang');

  const now = new Date();
  const resultLines = [];

  deductionPlan.operations.forEach(function(op) {
    // Guard ulang full identity agar transaksi OUT tidak "menabrak" perubahan lokasi/batch
    // yang mungkin terjadi setelah planning FEFO dibuat.
    const current = stockSheet.getRange(op.row, 1, 1, CONFIG.headers.stock.length).getValues()[0];
    const currentData = {
      idStock: clean_(current[0]),
      namaBarang: clean_(current[1]),
      tanggalProduksi: current[2],
      tanggalExpired: current[3],
      status: clean_(current[4]),
      lokasiRak: clean_(current[5]),
      qtyKeluar: toNumber_(current[7]),
      stockOnhand: toNumber_(current[8]),
      satuan: clean_(current[9]),
      nomorBSTB: clean_(current[10]),
      lotKey: clean_(current[14]),
      nomorBatch: clean_(current[19])
    };

    const mismatch = [];
    if (!sameText_(currentData.idStock, op.idStock)) mismatch.push('ID Stock');
    if (!sameText_(currentData.namaBarang, op.namaBarang)) mismatch.push('Nama Barang');
    if (!sameText_(currentData.satuan, op.satuan)) mismatch.push('Satuan');
    if (!sameText_(currentData.lokasiRak, op.lokasiRak)) mismatch.push('Lokasi Rak');
    if (!sameText_(currentData.nomorBatch, op.nomorBatch)) mismatch.push('Nomor Batch');
    if (!sameText_(currentData.nomorBSTB, op.nomorBSTB)) mismatch.push('Nomor BSTB');
    if (dateKeySafe_(currentData.tanggalExpired) !== dateKeySafe_(op.tanggalExpired)) mismatch.push('Tanggal Expired');
    if (clean_(op.lotKey) && !sameText_(currentData.lotKey, op.lotKey)) mismatch.push('Key Lot');
    if (currentData.qtyKeluar !== op.oldQtyKeluar) mismatch.push('Qty Keluar');
    if (currentData.stockOnhand !== op.oldStock) mismatch.push('Stock Onhand');

    if (mismatch.length) {
      throw new Error(
        'Stock berubah saat transaksi diproses untuk ID Stock ' + op.idStock +
        ' (' + mismatch.join(', ') + '). Proses dibatalkan agar lokasi/batch tidak bertumbukan. ' +
        'Refresh data stock lalu ulangi transaksi.'
      );
    }

    stockSheet.getRange(op.row, 8, 1, 2).setValues([[op.newQtyKeluar, op.newStock]]);
    stockSheet.getRange(op.row, 14).setValue(now);
    stockSheet.getRange(op.row, 16).setValue(clean_(data.namaUserTransaksi));

    const rowBarangKeluar = appendRowByHeader_(CONFIG.sheets.barangKeluar, 'barangKeluar', [
      now,
      toDate_(data.tglDimuat),
      resto.kode,
      resto.nama,
      resto.nopol,
      resto.wa,
      resto.sopir,
      clean_(op.namaBarang),
      op.deductQty,
      clean_(op.satuan),
      clean_(data.shiftOut),
      clean_(data.nomorSuratJalan),
      clean_(data.nomorITKirim),
      clean_(op.lokasiRak),
      clean_(op.idStock),
      clean_(op.nomorBSTB),
      op.tanggalExpired,
      otdrId,
      clean_(op.sourceLine.keterangan || data.keterangan),
      clean_(data.namaUserTransaksi),
      '',
      '',
      clean_(op.nomorBatch),
      clean_(op.sourceLine.nomorPO || data.nomorPO),
      clean_(op.sourceLine.idPicking),
      clean_(op.sourceLine.rowPickingList),
      clean_(op.sourceLine.idPicking || op.sourceLine.rowPickingList ? 'TERELASI PICKING' : '')
    ]);

    logMutasi_({
      jenisMutasi: 'OUT', tanggalTransaksi: toDate_(data.tglDimuat), namaBarang: clean_(op.namaBarang),
      tanggalProduksi: op.tanggalProduksi, tanggalExpired: op.tanggalExpired, status: clean_(op.status),
      lokasiRak: clean_(op.lokasiRak), qtyMasuk: 0, qtyKeluar: op.deductQty, saldoAkhirLot: op.newStock,
      satuan: clean_(op.satuan), idStock: clean_(op.idStock), nomorBSTB: clean_(op.nomorBSTB),
      nomorITKirim: clean_(data.nomorITKirim), kodeResto: resto.kode, namaResto: resto.nama,
      nomorSuratJalan: clean_(data.nomorSuratJalan), shiftKoordinator: clean_(data.shiftOut),
      namaUserTransaksi: clean_(data.namaUserTransaksi),
      keterangan: 'ID OTDR: ' + otdrId + '. ' + clean_(op.sourceLine.keterangan || data.keterangan),
      nomorBatch: clean_(op.nomorBatch)
    });

    resultLines.push({
      idStock: op.idStock,
      nomorBatch: op.nomorBatch,
      qty: op.deductQty,
      lokasiRak: op.lokasiRak,
      namaBarang: op.namaBarang,
      rowBarangKeluar: rowBarangKeluar,
      nomorPO: clean_(op.sourceLine.nomorPO || data.nomorPO),
      idPicking: clean_(op.sourceLine.idPicking),
      rowPickingList: clean_(op.sourceLine.rowPickingList)
    });
  });

  return resultLines;
}

function createBarangKeluarRollbackSnapshot_() {
  return ['stock', 'barangKeluar', 'mutasiBarang', 'otdr', 'noticeTransaksi', 'pickingList'].map(function(sheetKey) {
    return captureSheetSnapshotForRollback_(sheetKey);
  });
}

function createBarangMasukRollbackSnapshot_() {
  return ['stock', 'barangMasuk', 'mutasiBarang', 'noticeTransaksi'].map(function(sheetKey) {
    return captureSheetSnapshotForRollback_(sheetKey);
  });
}

function captureSheetSnapshotForRollback_(sheetKey) {
  const sheet = ensureConfiguredSheetByKey_(sheetKey);
  const width = Math.max((CONFIG.headers[sheetKey] || []).length, sheet.getLastColumn(), 1);
  const height = Math.max(sheet.getLastRow(), 1);
  return {
    sheetKey: sheetKey,
    sheetName: CONFIG.sheets[sheetKey],
    width: width,
    height: height,
    values: sheet.getRange(1, 1, height, width).getValues()
  };
}

function restoreBarangKeluarRollbackSnapshot_(snapshots) {
  (snapshots || []).forEach(function(snapshot) {
    const sheet = getSheet_(snapshot.sheetName);
    if (sheet.getMaxColumns() < snapshot.width) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), snapshot.width - sheet.getMaxColumns());
    }
    const rowsToClear = Math.max(sheet.getLastRow(), snapshot.height, 1);
    sheet.getRange(1, 1, rowsToClear, snapshot.width).clearContent();
    sheet.getRange(1, 1, snapshot.values.length, snapshot.width).setValues(snapshot.values);
  });
}

function checkBarangMasukNotice(data) {
  data = data || {};
  ensureSystemReady_();
  const login = validateAuth_(data.auth, 'masuk');
  if (!login.access.supervisor) data.shiftIn = login.namaUser;
  data.namaUserTransaksi = login.namaUser;
  return buildBarangMasukNotice_(data, login);
}

function checkBarangKeluarNotice(data) {
  data = data || {};
  ensureSystemReady_();
  const login = validateAuth_(data.auth, 'keluar');
  if (!login.access.supervisor) data.shiftOut = login.namaUser;
  data.namaUserTransaksi = login.namaUser;
  const resto = getRestoById_(data.restoId);
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  const validOutputs = outputs.map(function(line) {
    return {
      namaBarang: clean_(line.namaBarang),
      qtyKeluar: parsePositiveInteger_(line.qtyKeluar, 'Qty keluar'),
      satuan: clean_(line.satuan),
      lokasiRak: clean_(line.lokasiRak),
      idStock: clean_(line.idStock),
      nomorBatch: clean_(line.nomorBatch),
      keterangan: clean_(line.keterangan)
    };
  });
  return buildBarangKeluarNotice_(data, resto, validOutputs, login);
}

function isNoticeConfirmed_(data) {
  data = data || {};
  const value = data.confirmNotice || data.noticeConfirmed || data.forceSubmit;
  return value === true || normalizeKey_(value) === 'TRUE' || normalizeKey_(value) === 'YA' || normalizeKey_(value) === 'YES';
}

function buildNoticeResponse_(jenisTransaksi, keyData, notices) {
  const cleanNotices = (notices || []).filter(String);
  const limited = cleanNotices.slice(0, 8);
  const extra = cleanNotices.length > limited.length ? '\n... +' + (cleanNotices.length - limited.length) + ' notice lain.' : '';
  const message = 'NOTICE KOORDINATOR - ' + jenisTransaksi + '\n\n' +
    'Sistem menemukan kemungkinan data double/bertumbukan sebelum disimpan:\n' +
    limited.map(function(note, idx) { return (idx + 1) + '. ' + note; }).join('\n') + extra +
    '\n\nJika memang ini transaksi yang benar, lanjutkan dengan konfirmasi. Jika ragu, klik Batal lalu cek database terlebih dahulu.';
  return { ok: cleanNotices.length === 0, needConfirm: cleanNotices.length > 0, keyData: keyData, notices: cleanNotices, message: message };
}

function buildBarangMasukNotice_(data, login) {
  data = data || {};
  const notices = [];
  const namaBarang = clean_(data.namaBarang);
  const nomorBSTB = clean_(data.nomorBSTB);
  const satuan = clean_(data.satuan);
  const status = clean_(data.status);
  const tglBSTBKey = dateKeySafe_(data.tanggalBSTB);
  const tglProdKey = dateKeySafe_(data.tanggalProduksi);

  let batchRows = [];
  try {
    batchRows = normalizeBarangMasukBatches_(data);
  } catch (err) {
    const lokasiRak = clean_(data.lokasiRak);
    batchRows = [{ nomorBatch: clean_(data.nomorBatch), qty: toNumber_(data.qty), lokasiRak: lokasiRak, keterangan: clean_(data.keterangan), rowNumber: 1 }];
  }
  const batchSummary = summarizeBarangMasukBatches_(batchRows);
  const keyData = ['IN', tglBSTBKey, nomorBSTB, namaBarang, tglProdKey, batchSummary.lokasiRakText, batchSummary.nomorBatchText, satuan].join('|');

  let tanggalExpiredFinal = '';
  try {
    const expiredBulan = toNumber_(getExpiredMonthsByBarang_(namaBarang) || data.expiredBulan);
    tanggalExpiredFinal = calculateExpiredDate_(data.tanggalProduksi, expiredBulan);
  } catch (err) {
    // Validasi expired tetap dilakukan saat submit utama. Notice tidak perlu memblokir lebih dulu.
  }

  const existingIn = readConfiguredRowsAsObjects_('barangMasuk');

  batchRows.forEach(function(batch) {
    const lokasiRak = clean_(batch.lokasiRak);
    const nomorBatch = clean_(batch.nomorBatch);
    const labelBatch = nomorBatch ? ('batch ' + nomorBatch + ', ') : '';

    const exactRows = existingIn.filter(function(row) {
      const rowBatch = clean_(row['Nomor Batch']);
      return sameText_(row['Nomor Bukti Serah Terima Barang'], nomorBSTB) &&
        sameText_(row['Nama Barang'], namaBarang) &&
        sameText_(row['Lokasi Rak'], lokasiRak) &&
        sameText_(row['Satuan'], satuan) &&
        (!nomorBatch || sameText_(rowBatch, nomorBatch)) &&
        dateKeySafe_(row['Tanggal Bukti Serah Terima Barang']) === tglBSTBKey &&
        dateKeySafe_(row['Tanggal Produksi']) === tglProdKey;
    });
    if (exactRows.length) {
      notices.push('Barang masuk ' + labelBatch + 'dengan Nomor BSTB, barang, tanggal produksi, satuan, dan lokasi rak yang sama sudah ada ' + exactRows.length + ' baris di BARANG_MASUK. Baris contoh: ' + exactRows.slice(0, 3).map(function(r) { return r._rowNumber; }).join(', ') + '.');
    }

    const sameDayRackRows = existingIn.filter(function(row) {
      return sameText_(row['Lokasi Rak'], lokasiRak) &&
        dateKeySafe_(row['Tanggal Bukti Serah Terima Barang']) === tglBSTBKey &&
        !sameText_(row['Nomor Bukti Serah Terima Barang'], nomorBSTB);
    });
    if (sameDayRackRows.length) {
      notices.push('Lokasi rak ' + lokasiRak + ' pada baris batch ' + batch.rowNumber + ' sudah dipakai transaksi barang masuk lain pada tanggal BSTB yang sama. Cek agar rak tidak dipakai ganda.');
    }

    if (tanggalExpiredFinal) {
      const lotKey = makeLotKey_(namaBarang, data.tanggalProduksi, tanggalExpiredFinal, status, lokasiRak, nomorBSTB, satuan, nomorBatch);
      const stockLot = getStockRows_().find(function(item) { return String(item.lotKey) === String(lotKey); });
      if (stockLot) {
        notices.push('Lot stock yang sama sudah ada di STOCK_ONHAND: ' + stockLot.idStock + ', batch ' + (stockLot.nomorBatch || nomorBatch || '-') + ', stock saat ini ' + stockLot.stockOnhand + ' ' + stockLot.satuan + ', input terakhir: ' + (stockLot.namaUserInputTerakhir || '-') + '.');
      }
    }

    const lastOutSameRack = getRackLastOutByRack_(lokasiRak);
    if (lastOutSameRack && tglBSTBKey && dateKeySafe_(lastOutSameRack.tanggalKeluar) === tglBSTBKey) {
      notices.push('Info rak ' + lokasiRak + ': pada tanggal yang sama ada transaksi BARANG KELUAR tanggal ' + (lastOutSameRack.tanggalKeluar || '-') + ' untuk ' + (lastOutSameRack.namaBarang || '-') + ', qty ' + (lastOutSameRack.qtyKeluar || 0) + ' ' + (lastOutSameRack.satuan || '') + '.');
    }

    const stockSameRackRows = getStockRows_().filter(function(item) {
      return sameText_(item.lokasiRak, lokasiRak) && toNumber_(item.stockOnhand) > 0;
    });
    if (stockSameRackRows.length) {
      const totalRackQty = stockSameRackRows.reduce(function(sum, item) { return sum + toNumber_(item.stockOnhand); }, 0);
      notices.push('Info rak ' + lokasiRak + ': masih ada ' + stockSameRackRows.length + ' batch/lot aktif dengan total stock ' + totalRackQty + '. Sistem tetap mengizinkan barang masuk ke rak ini selama nomor batch/lot dibedakan.');
    }
  });

  const sameBstbRows = existingIn.filter(function(row) {
    return sameText_(row['Nomor Bukti Serah Terima Barang'], nomorBSTB) &&
      sameText_(row['Nama Barang'], namaBarang) &&
      dateKeySafe_(row['Tanggal Bukti Serah Terima Barang']) === tglBSTBKey;
  });
  if (sameBstbRows.length) {
    notices.push('Nomor BSTB ' + nomorBSTB + ' untuk barang ' + namaBarang + ' pada tanggal BSTB yang sama sudah pernah diinput ' + sameBstbRows.length + ' baris. Pastikan bukan input ulang oleh koordinator lain.');
  }

  return buildNoticeResponse_('BARANG MASUK', keyData, notices);
}

function buildBarangKeluarNotice_(data, resto, validOutputs, login) {
  data = data || {};
  resto = resto || {};
  validOutputs = validOutputs || [];
  const notices = [];
  const tglDimuatKey = dateKeySafe_(data.tglDimuat);
  const kodeResto = clean_(resto.kode || data.kodeResto);
  const namaResto = clean_(resto.nama || data.namaResto);
  const nomorSJ = clean_(data.nomorSuratJalan);
  const keyData = ['OUT', tglDimuatKey, kodeResto, nomorSJ, validOutputs.map(function(line) { return clean_(line.namaBarang) + ':' + clean_(line.qtyKeluar) + ':' + clean_(line.idStock || line.nomorBatch || line.lokasiRak || 'FEFO'); }).join(';')].join('|');

  const requestKeyMap = {};
  validOutputs.forEach(function(line, idx) {
    const key = [clean_(line.namaBarang), clean_(line.satuan), clean_(line.idStock || ''), clean_(line.nomorBatch || ''), clean_(line.lokasiRak || 'FEFO')].map(normalizeKey_).join('|');
    if (requestKeyMap[key] !== undefined) {
      notices.push('Output baris ' + (requestKeyMap[key] + 1) + ' dan baris ' + (idx + 1) + ' memakai barang/satuan/lot/rak yang sama. Gabungkan qty atau pastikan memang diperlukan agar tidak double deduction.');
    } else {
      requestKeyMap[key] = idx;
    }
  });

  const existingOut = readConfiguredRowsAsObjects_('barangKeluar');
  const sameSjRows = existingOut.filter(function(row) {
    return sameText_(row['Kode Resto'], kodeResto) &&
      sameText_(row['Nomor Surat Jalan'], nomorSJ) &&
      dateKeySafe_(row['Tanggal Dimuat']) === tglDimuatKey;
  });
  if (sameSjRows.length) {
    const items = {};
    sameSjRows.forEach(function(r) { if (clean_(r['Nama Barang'])) items[clean_(r['Nama Barang'])] = true; });
    notices.push('Nomor Surat Jalan ' + nomorSJ + ' untuk ' + kodeResto + ' - ' + namaResto + ' pada tanggal dimuat yang sama sudah pernah dibuat ' + sameSjRows.length + ' baris. Item sebelumnya: ' + Object.keys(items).slice(0, 5).join(', ') + '.');
  }

  validOutputs.forEach(function(line, idx) {
    const sameLineRows = existingOut.filter(function(row) {
      const sameBase = sameText_(row['Kode Resto'], kodeResto) &&
        sameText_(row['Nomor Surat Jalan'], nomorSJ) &&
        sameText_(row['Nama Barang'], line.namaBarang) &&
        sameText_(row['Satuan'], line.satuan) &&
        dateKeySafe_(row['Tanggal Dimuat']) === tglDimuatKey;
      if (!sameBase) return false;
      if (line.idStock) return sameText_(row['ID Stock'], line.idStock);
      if (line.nomorBatch && !sameText_(row['Nomor Batch'], line.nomorBatch)) return false;
      if (line.lokasiRak) return sameText_(row['Lokasi Rak'], line.lokasiRak);
      return true;
    });
    if (sameLineRows.length) {
      notices.push('Output baris ' + (idx + 1) + ' (' + line.namaBarang + ') mirip dengan data BARANG_KELUAR yang sudah ada pada SJ/tanggal/resto yang sama. Baris contoh: ' + sameLineRows.slice(0, 3).map(function(r) { return r._rowNumber; }).join(', ') + '.');
    }

    if (line.idStock) {
      const stock = getStockRows_().find(function(item) { return sameText_(item.idStock, line.idStock); });
      if (stock && toNumber_(stock.stockOnhand) <= 0) {
        notices.push('Output baris ' + (idx + 1) + ' memilih ID Stock ' + line.idStock + ' tetapi stock on hand sudah 0. Sistem akan menolak jika stok tidak tersedia.');
      }
    }
  });

  return buildNoticeResponse_('BARANG KELUAR', keyData, notices);
}

function logTransactionNotice_(jenisTransaksi, levelNotice, keyData, pesanNotice, userName, statusTindakan) {
  try {
    appendRowByHeader_(CONFIG.sheets.noticeTransaksi, 'noticeTransaksi', [
      new Date(),
      clean_(jenisTransaksi),
      clean_(levelNotice),
      clean_(keyData),
      clean_(pesanNotice),
      clean_(userName),
      clean_(statusTindakan)
    ]);
  } catch (err) {
    // Notice log tidak boleh menggagalkan transaksi utama.
  }
}

function processBarangKeluarLine_(data, line, resto, otdrId) {
  const qtyRequest = parsePositiveInteger_(line.qtyKeluar, 'Qty keluar');
  const stockSheet = getSheet_(CONFIG.sheets.stock);
  ensureSheetForWrite_(CONFIG.sheets.barangKeluar, 'barangKeluar');
  const rows = getStockRows_();

  let candidates = rows.filter(function(item) {
    const sameBarang = sameText_(item.namaBarang, line.namaBarang);
    const sameSatuan = sameText_(item.satuan, line.satuan);
    const available = toNumber_(item.stockOnhand) > 0;
    const sameLocation = line.lokasiRak ? sameText_(item.lokasiRak, line.lokasiRak) : true;
    const sameId = line.idStock ? sameText_(item.idStock, line.idStock) : true;
    return sameBarang && sameSatuan && available && sameLocation && sameId;
  });

  if (candidates.length === 0) throw new Error('Stock tidak tersedia untuk barang: ' + line.namaBarang);

  candidates.sort(function(a, b) {
    return new Date(a.tanggalExpired).getTime() - new Date(b.tanggalExpired).getTime();
  });

  const totalAvailable = candidates.reduce(function(sum, item) { return sum + toNumber_(item.stockOnhand); }, 0);
  if (totalAvailable < qtyRequest) {
    throw new Error('Stock tidak cukup untuk ' + line.namaBarang + '. Permintaan: ' + qtyRequest + ', tersedia: ' + totalAvailable);
  }

  let remaining = qtyRequest;
  const now = new Date();
  const resultLines = [];

  candidates.forEach(function(item) {
    if (remaining <= 0) return;

    const available = toNumber_(item.stockOnhand);
    const deductQty = Math.min(available, remaining);
    const newQtyKeluar = toNumber_(item.qtyKeluar) + deductQty;
    const newStock = available - deductQty;

    stockSheet.getRange(item.row, 8).setValue(newQtyKeluar);
    stockSheet.getRange(item.row, 9).setValue(newStock);
    stockSheet.getRange(item.row, 14).setValue(now);
    stockSheet.getRange(item.row, 16).setValue(clean_(data.namaUserTransaksi));

    appendRowByHeader_(CONFIG.sheets.barangKeluar, 'barangKeluar', [
      now,
      toDate_(data.tglDimuat),
      resto.kode,
      resto.nama,
      resto.nopol,
      resto.wa,
      resto.sopir,
      clean_(item.namaBarang),
      deductQty,
      clean_(item.satuan),
      clean_(data.shiftOut),
      clean_(data.nomorSuratJalan),
      clean_(data.nomorITKirim),
      clean_(item.lokasiRak),
      clean_(item.idStock),
      clean_(item.nomorBSTB),
      item.tanggalExpired,
      otdrId,
      clean_(line.keterangan || data.keterangan),
      clean_(data.namaUserTransaksi),
      '',
      ''
    ]);

    logMutasi_({
      jenisMutasi: 'OUT', tanggalTransaksi: toDate_(data.tglDimuat), namaBarang: clean_(item.namaBarang),
      tanggalProduksi: item.tanggalProduksi, tanggalExpired: item.tanggalExpired, status: clean_(item.status),
      lokasiRak: clean_(item.lokasiRak), qtyMasuk: 0, qtyKeluar: deductQty, saldoAkhirLot: newStock,
      satuan: clean_(item.satuan), idStock: clean_(item.idStock), nomorBSTB: clean_(item.nomorBSTB),
      nomorITKirim: clean_(data.nomorITKirim), kodeResto: resto.kode, namaResto: resto.nama,
      nomorSuratJalan: clean_(data.nomorSuratJalan), shiftKoordinator: clean_(data.shiftOut),
      namaUserTransaksi: clean_(data.namaUserTransaksi),
      keterangan: 'ID OTDR: ' + otdrId + '. ' + clean_(line.keterangan || data.keterangan)
    });

    resultLines.push({ idStock: item.idStock, qty: deductQty, lokasiRak: item.lokasiRak, namaBarang: item.namaBarang });
    remaining -= deductQty;
  });

  return resultLines;
}

function createOrUpdateOtdrDraft_(data) {
  const sheet = getSheet_(CONFIG.sheets.otdr);
  const now = new Date();
  const resto = data.resto;
  const nomorSuratJalan = clean_(data.nomorSuratJalan);
  const nomorITKirim = clean_(data.nomorITKirim);
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.otdr.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const sameSj = sameText_(row[6], nomorSuratJalan);
      const sameKode = sameText_(row[4], resto.kode);
      const sameNopol = sameText_(row[8], resto.nopol);
      if (sameSj && sameKode && sameNopol) {
        const rowNumber = i + 2;
        sheet.getRange(rowNumber, 2).setValue(now);
        sheet.getRange(rowNumber, 8).setValue(nomorITKirim);
        sheet.getRange(rowNumber, 16).setValue(toNumber_(row[15]) + toNumber_(data.totalItem));
        sheet.getRange(rowNumber, 17).setValue(toNumber_(row[16]) + toNumber_(data.totalQty));
        if (data.keterangan) sheet.getRange(rowNumber, 18).setValue(clean_(data.keterangan));
        sheet.getRange(rowNumber, 20).setValue(clean_(data.namaUserTransaksi));
        ensureOtdrDriverLink_(sheet, rowNumber, row);
        return row[2];
      }
    }
  }

  const otdrId = generateOtdrId_();
  const driverToken = makeDriverToken_(otdrId);
  const driverUrl = getDriverDashboardUrlByToken_(driverToken);
  sheet.appendRow([
    now, now, otdrId, toDate_(data.tglDimuat), resto.kode, resto.nama,
    nomorSuratJalan, nomorITKirim, resto.nopol, resto.wa, resto.sopir,
    '', '', '', 'BELUM LENGKAP', toNumber_(data.totalItem), toNumber_(data.totalQty), clean_(data.keterangan),
    clean_(data.namaUserTransaksi), clean_(data.namaUserTransaksi),
    driverUrl, driverToken, '', '', '', '', '', '', '', ''
  ]);
  return otdrId;
}

function getOtdrList(filter) {
  filter = filter || {};
  const sheet = getSheet_(CONFIG.sheets.otdr);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  let rows = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.otdr.length).getValues().map(function(row, idx) {
    const rowNumber = idx + 2;
    const driverInfo = ensureOtdrDriverLink_(sheet, rowNumber, row);
    return {
      timestampCreate: row[0], timestampUpdate: row[1], idOtdr: row[2], tanggalDimuat: row[3],
      kodeResto: row[4], namaResto: row[5], nomorSuratJalan: row[6], nomorITKirim: row[7],
      nopol: row[8], waSopir: row[9], namaSopir: row[10], startMuat: row[11], selesaiMuat: row[12],
      namaMuat: row[13], statusOtdr: row[14], totalItem: row[15], totalQty: row[16], catatan: row[17],
      namaUserCreate: row[18], namaUserUpdate: row[19], driverDashboardUrl: driverInfo.url,
      driverToken: driverInfo.token, statusTerimaSopir: row[22], tanggalTerimaSopir: row[23],
      namaPenerima: row[24], namaChecker: row[25], statusChecker: row[26], linkBuktiFoto: row[27],
      catatanBuktiTerima: row[28], idFileBukti: row[29]
    };
  });

  if (filter.statusNotDoneOnly) {
    rows = rows.filter(function(item) { return !isOtdrDoneStatus_(item.statusOtdr); });
  }
  if (filter.kodeResto) {
    rows = rows.filter(function(item) { return sameText_(item.kodeResto, filter.kodeResto); });
  }

  rows.sort(function(a, b) { return new Date(b.timestampCreate).getTime() - new Date(a.timestampCreate).getTime(); });
  return rows.map(formatOtdrForClient_);
}

function getOtdrById(idOtdr) {
  const sheet = getSheet_(CONFIG.sheets.otdr);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data OTDR belum ada.');
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.otdr.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (sameText_(values[i][2], idOtdr)) {
      const row = values[i];
      const driverInfo = ensureOtdrDriverLink_(sheet, i + 2, row);
      return formatOtdrForClient_({
        timestampCreate: row[0], timestampUpdate: row[1], idOtdr: row[2], tanggalDimuat: row[3],
        kodeResto: row[4], namaResto: row[5], nomorSuratJalan: row[6], nomorITKirim: row[7],
        nopol: row[8], waSopir: row[9], namaSopir: row[10], startMuat: row[11], selesaiMuat: row[12],
        namaMuat: row[13], statusOtdr: row[14], totalItem: row[15], totalQty: row[16], catatan: row[17],
        namaUserCreate: row[18], namaUserUpdate: row[19], driverDashboardUrl: driverInfo.url,
        driverToken: driverInfo.token, statusTerimaSopir: row[22], tanggalTerimaSopir: row[23],
        namaPenerima: row[24], namaChecker: row[25], statusChecker: row[26], linkBuktiFoto: row[27],
        catatanBuktiTerima: row[28], idFileBukti: row[29]
      });
    }
  }
  throw new Error('ID OTDR tidak ditemukan: ' + idOtdr);
}


function validateOtdrAccess_(auth) {
  const user = validateAuth_(auth, '');
  if (!user.access.supervisor && !user.access.otdr && !user.access.keluar) {
    throw new Error('User ' + user.namaUser + ' tidak punya akses untuk menu OTDR/Barang Keluar.');
  }
  return user;
}

function updateOtdr(data) {
  validateRequired_(data, ['idOtdr']);
  const login = validateOtdrAccess_(data.auth);

  const sheet = getSheet_(CONFIG.sheets.otdr);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data OTDR belum ada.');

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.otdr.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (sameText_(values[i][2], data.idOtdr)) {
      const rowNumber = i + 2;
      const currentStatus = clean_(values[i][14]);
      const loadingStatus = data.startMuat && data.selesaiMuat && data.namaMuat ? 'LENGKAP' : 'BELUM LENGKAP';
      const status = sameText_(currentStatus, 'COMPLETE') ? 'COMPLETE' : loadingStatus;
      sheet.getRange(rowNumber, 2).setValue(new Date());
      sheet.getRange(rowNumber, 9).setValue(clean_(data.nopol));
      sheet.getRange(rowNumber, 10).setValue(clean_(data.waSopir));
      sheet.getRange(rowNumber, 11).setValue(clean_(data.namaSopir));
      sheet.getRange(rowNumber, 12).setValue(data.startMuat ? toDateTime_(data.startMuat) : '');
      sheet.getRange(rowNumber, 13).setValue(data.selesaiMuat ? toDateTime_(data.selesaiMuat) : '');
      sheet.getRange(rowNumber, 14).setValue(clean_(data.namaMuat));
      sheet.getRange(rowNumber, 15).setValue(status);
      sheet.getRange(rowNumber, 18).setValue(clean_(data.catatan));
      sheet.getRange(rowNumber, 20).setValue(clean_(login.namaUser));
      return { ok: true, message: 'OTDR berhasil diupdate. Status: ' + status + '. Diupdate oleh: ' + login.namaUser };
    }
  }
  throw new Error('ID OTDR tidak ditemukan: ' + data.idOtdr);
}

function formatOtdrForClient_(item) {
  return {
    idOtdr: item.idOtdr,
    tanggalDimuat: dateDisplay_(item.tanggalDimuat),
    kodeResto: item.kodeResto,
    namaResto: item.namaResto,
    nomorSuratJalan: item.nomorSuratJalan,
    nomorITKirim: item.nomorITKirim,
    nopol: item.nopol,
    waSopir: item.waSopir,
    namaSopir: item.namaSopir,
    startMuat: dateTimeInputDisplay_(item.startMuat),
    selesaiMuat: dateTimeInputDisplay_(item.selesaiMuat),
    namaMuat: item.namaMuat,
    statusOtdr: item.statusOtdr,
    totalItem: item.totalItem,
    totalQty: item.totalQty,
    catatan: item.catatan,
    namaUserCreate: item.namaUserCreate,
    namaUserUpdate: item.namaUserUpdate,
    driverDashboardUrl: item.driverDashboardUrl || '',
    statusTerimaSopir: item.statusTerimaSopir || '',
    tanggalTerimaSopir: dateTimeDisplay_(item.tanggalTerimaSopir),
    namaPenerima: item.namaPenerima || '',
    namaChecker: item.namaChecker || '',
    statusChecker: item.statusChecker || '',
    linkBuktiFoto: item.linkBuktiFoto || '',
    catatanBuktiTerima: item.catatanBuktiTerima || '',
    label: item.idOtdr + ' | ' + dateDisplay_(item.tanggalDimuat) + ' | ' + item.kodeResto + ' - ' + item.namaResto + ' | SJ: ' + item.nomorSuratJalan + ' | ' + item.nopol
  };
}

function isOtdrDoneStatus_(status) {
  const key = normalizeKey_(status);
  return key === 'LENGKAP' || key === 'LOADING LENGKAP' || key === 'COMPLETE';
}

function makeDriverToken_(idOtdr) {
  return Utilities.getUuid().replace(/-/g, '') + '-' + Utilities.base64EncodeWebSafe(String(idOtdr || new Date().getTime())).replace(/=+$/g, '');
}

function getWebAppUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}

function getDriverDashboardUrlByToken_(token) {
  const baseUrl = getWebAppUrl_();
  if (!baseUrl) return '';
  return baseUrl + '?page=sopir&token=' + encodeURIComponent(token);
}

function ensureOtdrDriverLink_(sheet, rowNumber, row) {
  row = row || [];
  const idOtdr = clean_(row[2] || sheet.getRange(rowNumber, 3).getValue());
  let token = clean_(row[21]);
  if (!token) token = makeDriverToken_(idOtdr);
  const url = getDriverDashboardUrlByToken_(token);
  if (url && clean_(row[20]) !== url) sheet.getRange(rowNumber, 21).setValue(url);
  if (!clean_(row[21])) sheet.getRange(rowNumber, 22).setValue(token);
  return { token: token, url: url };
}

function normalizeWaNumber_(value) {
  let wa = String(value || '').replace(/[^0-9]/g, '');
  if (!wa) return '';
  if (wa.charAt(0) === '0') wa = '62' + wa.substring(1);
  if (wa.substring(0, 2) !== '62' && wa.charAt(0) === '8') wa = '62' + wa;
  return wa;
}

function getOtdrWaLink(data) {
  data = data || {};
  validateOtdrAccess_(data.auth);
  const otdr = getOtdrById(data.idOtdr);
  const wa = normalizeWaNumber_(otdr.waSopir);
  if (!wa) throw new Error('WA Sopir belum diisi pada OTDR ' + data.idOtdr + '.');
  if (!otdr.driverDashboardUrl) {
    throw new Error('Link dashboard sopir belum tersedia. Deploy script sebagai Web App terlebih dahulu, lalu jalankan Setup / Perbaiki Sheet.');
  }
  const message = [
    'Halo ' + (otdr.namaSopir || 'Bapak/Ibu Sopir') + ',',
    '',
    'Mohon konfirmasi penerimaan barang untuk:',
    'ID OTDR: ' + otdr.idOtdr,
    'Resto: ' + otdr.kodeResto + ' - ' + otdr.namaResto,
    'Nomor SJ: ' + (otdr.nomorSuratJalan || '-'),
    'Nopol: ' + (otdr.nopol || '-'),
    '',
    'Silakan buka dashboard ini untuk upload foto bukti/TTD dan checklist barang diterima sesuai:',
    otdr.driverDashboardUrl
  ].join('\n');
  return { ok: true, waUrl: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(message), dashboardUrl: otdr.driverDashboardUrl };
}

function findOtdrRowByDriverToken_(token) {
  token = clean_(token);
  if (!token) throw new Error('Token dashboard sopir tidak ditemukan. Minta link WA terbaru dari checker/supervisor.');
  const sheet = ensureConfiguredSheetByKey_('otdr');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data OTDR belum ada.');
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.otdr.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (sameText_(values[i][21], token)) {
      return { sheet: sheet, rowNumber: i + 2, row: values[i] };
    }
  }
  throw new Error('Link dashboard sopir tidak valid atau sudah berubah. Minta link terbaru dari checker/supervisor.');
}

function getOtdrOutputItems_(idOtdr) {
  const sheet = ensureConfiguredSheetByKey_('barangKeluar');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.barangKeluar.length).getValues();
  return values.filter(function(row) { return sameText_(row[17], idOtdr); }).map(function(row) {
    return {
      namaBarang: clean_(row[7]),
      qtyKeluar: row[8],
      satuan: clean_(row[9]),
      lokasiRak: clean_(row[13]),
      idStock: clean_(row[14]),
      tanggalExpired: dateDisplay_(row[16]),
      keterangan: clean_(row[18])
    };
  });
}

function getDriverDashboardData(token) {
  ensureSystemReady_();
  const found = findOtdrRowByDriverToken_(token);
  const row = found.row;
  const item = formatOtdrForClient_({
    timestampCreate: row[0], timestampUpdate: row[1], idOtdr: row[2], tanggalDimuat: row[3],
    kodeResto: row[4], namaResto: row[5], nomorSuratJalan: row[6], nomorITKirim: row[7],
    nopol: row[8], waSopir: row[9], namaSopir: row[10], startMuat: row[11], selesaiMuat: row[12],
    namaMuat: row[13], statusOtdr: row[14], totalItem: row[15], totalQty: row[16], catatan: row[17],
    namaUserCreate: row[18], namaUserUpdate: row[19], driverDashboardUrl: row[20], driverToken: row[21],
    statusTerimaSopir: row[22], tanggalTerimaSopir: row[23], namaPenerima: row[24], namaChecker: row[25],
    statusChecker: row[26], linkBuktiFoto: row[27], catatanBuktiTerima: row[28], idFileBukti: row[29]
  });
  return { ok: true, otdr: item, items: getOtdrOutputItems_(item.idOtdr) };
}

function ensureEvidenceSheet_() {
  const sheet = ensureConfiguredSheetByKey_('otdrEvidence');
  return sheet;
}

function getOrCreateEvidenceFolder_() {
  const folderName = 'OTDR_BUKTI_TERIMA';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function saveEvidenceFile_(idOtdr, fileObj) {
  if (!fileObj || !fileObj.base64) return { url: '', fileId: '' };
  const mimeType = clean_(fileObj.mimeType || 'image/jpeg');
  const ext = mimeType.indexOf('png') !== -1 ? '.png' : (mimeType.indexOf('pdf') !== -1 ? '.pdf' : '.jpg');
  const rawName = clean_(fileObj.filename || ('Bukti_' + idOtdr + ext));
  const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_');
  const bytes = Utilities.base64Decode(fileObj.base64);
  const blob = Utilities.newBlob(bytes, mimeType, Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyyMMdd_HHmmss') + '_' + idOtdr + '_' + safeName);
  const file = getOrCreateEvidenceFolder_().createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
  return { url: file.getUrl(), fileId: file.getId() };
}

function submitDriverDeliveryEvidence(data) {
  ensureSystemReady_();
  data = data || {};
  const found = findOtdrRowByDriverToken_(data.token);
  const sheet = found.sheet;
  const row = found.row;
  const rowNumber = found.rowNumber;
  const statusTerima = normalizeKey_(data.statusTerima || '');
  const namaPenerima = clean_(data.namaPenerima);
  const namaChecker = clean_(data.namaChecker);
  const catatan = clean_(data.catatan);

  if (statusTerima !== 'SESUAI' && statusTerima !== 'TIDAK SESUAI') {
    throw new Error('Pilih status barang: SESUAI atau TIDAK SESUAI.');
  }
  if (!namaPenerima) throw new Error('Nama penerima wajib diisi.');
  if (!namaChecker) throw new Error('Nama checker wajib diisi.');

  let bukti = { url: clean_(row[27]), fileId: clean_(row[29]) };
  if (data.file && data.file.base64) bukti = saveEvidenceFile_(row[2], data.file);
  if (!bukti.url) throw new Error('Foto/dokumen bukti terima wajib diupload.');

  const now = new Date();
  const statusChecker = statusTerima === 'SESUAI' ? 'CHECKER OK' : 'CHECKER PERLU TINDAK LANJUT';
  const finalStatus = statusTerima === 'SESUAI' ? 'COMPLETE' : 'DITERIMA - TIDAK SESUAI';

  sheet.getRange(rowNumber, 2).setValue(now);
  sheet.getRange(rowNumber, 15).setValue(finalStatus);
  sheet.getRange(rowNumber, 18).setValue(catatan || (statusTerima === 'SESUAI' ? 'Barang diterima dan sesuai oleh sopir/checker.' : 'Barang diterima tetapi tidak sesuai. Perlu follow up.'));
  sheet.getRange(rowNumber, 20).setValue(namaChecker);
  sheet.getRange(rowNumber, 23).setValue(statusTerima);
  sheet.getRange(rowNumber, 24).setValue(now);
  sheet.getRange(rowNumber, 25).setValue(namaPenerima);
  sheet.getRange(rowNumber, 26).setValue(namaChecker);
  sheet.getRange(rowNumber, 27).setValue(statusChecker);
  sheet.getRange(rowNumber, 28).setValue(bukti.url);
  sheet.getRange(rowNumber, 29).setValue(catatan);
  sheet.getRange(rowNumber, 30).setValue(bukti.fileId);

  ensureEvidenceSheet_().appendRow([
    now, row[2], row[3], row[4], row[5], row[6], row[8], row[9], row[10],
    statusTerima, namaPenerima, namaChecker, statusChecker, bukti.url, catatan, bukti.fileId,
    clean_(data.userAgent || 'Dashboard Sopir')
  ]);

  return {
    ok: true,
    message: statusTerima === 'SESUAI'
      ? 'Terima kasih. Bukti berhasil disimpan dan status OTDR otomatis menjadi COMPLETE.'
      : 'Bukti berhasil disimpan. Status OTDR menjadi DITERIMA - TIDAK SESUAI untuk follow up checker.',
    statusOtdr: finalStatus,
    linkBuktiFoto: bukti.url,
    submittedAt: dateTimeDisplay_(now)
  };
}


function updateLokasiStock(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('NOTICE KOORDINATOR: Ada transaksi stock/lokasi yang sedang diproses user lain. Tunggu beberapa detik lalu simpan ulang agar lokasi tidak bertumbukan.');
  }
  try {
    // Lokasi dan status dibuat opsional:
      // - Isi lokasiBaru jika ingin pindah rak.
      // - Isi statusBaru jika ingin ubah status, misalnya HOLD menjadi RELEASE.
      validateRequired_(data, ['idStock', 'pic']);
      const login = validateAuth_(data.auth, 'lokasi');
      if (!login.access.supervisor) data.pic = login.namaUser;

      const stockSheet = getSheet_(CONFIG.sheets.stock);
      const logSheet = getSheet_(CONFIG.sheets.logLokasi);
      const rows = getStockRows_();
      const item = rows.find(function(row) { return sameText_(row.idStock, data.idStock); });
      if (!item) throw new Error('ID Stock tidak ditemukan: ' + data.idStock);

      const lokasiLama = clean_(item.lokasiRak);
      const statusLama = clean_(item.status);
      const lokasiBaru = clean_(data.lokasiBaru) || lokasiLama;
      const statusBaru = clean_(data.statusBaru) || statusLama;

      const lokasiBerubah = !sameText_(lokasiLama, lokasiBaru);
      const statusBerubah = !sameText_(statusLama, statusBaru);

      if (statusBerubah && !login.access.supervisor) {
        const allowedStatusForInventory = ['GOOD', 'HOLD'];
        if (allowedStatusForInventory.indexOf(normalizeKey_(statusBaru)) === -1) {
          throw new Error('User Inventory hanya boleh update status menjadi GOOD atau HOLD. Untuk status lain gunakan user Supervisor.');
        }
      }

      if (!lokasiBerubah && !statusBerubah) {
        throw new Error('Tidak ada perubahan. Pilih lokasi baru atau status baru terlebih dahulu.');
      }

      const newKey = makeLotKey_(item.namaBarang, item.tanggalProduksi, item.tanggalExpired, statusBaru, lokasiBaru, item.nomorBSTB, item.satuan, item.nomorBatch);
      const existingSameLot = getStockRows_().find(function(row) {
        return !sameText_(row.idStock, item.idStock) && String(row.lotKey) === String(newKey) && toNumber_(row.stockOnhand) > 0;
      });
      if (existingSameLot) {
        throw new Error('Pindah lokasi/status dibatalkan: lot yang sama sudah ada di Rak ' + lokasiBaru + ' dengan ID Stock ' + existingSameLot.idStock + '. Bedakan nomor batch atau gunakan lot yang sudah ada agar tidak double.');
      }


      // STOCK_ONHAND: kolom 5 = Status, kolom 6 = Lokasi Rak, kolom 14 = Last Update, kolom 15 = Key Lot
      stockSheet.getRange(item.row, 5).setValue(statusBaru);
      stockSheet.getRange(item.row, 6).setValue(lokasiBaru);
      stockSheet.getRange(item.row, 14).setValue(new Date());
      stockSheet.getRange(item.row, 15).setValue(newKey);
      stockSheet.getRange(item.row, 16).setValue(clean_(login.namaUser));

      logSheet.appendRow([
        new Date(),
        clean_(item.idStock),
        clean_(item.namaBarang),
        lokasiLama,
        lokasiBaru,
        statusLama,
        statusBaru,
        clean_(data.pic),
        clean_(data.keterangan),
        clean_(login.namaUser)
      ]);

      const perubahan = [];
      if (lokasiBerubah) perubahan.push('Pindah lokasi dari ' + lokasiLama + ' ke ' + lokasiBaru);
      if (statusBerubah) perubahan.push('Update status dari ' + statusLama + ' ke ' + statusBaru);

      logMutasi_({
        jenisMutasi: lokasiBerubah ? 'PINDAH_LOKASI' : 'UPDATE_STATUS',
        tanggalTransaksi: new Date(),
        namaBarang: clean_(item.namaBarang),
        tanggalProduksi: item.tanggalProduksi,
        tanggalExpired: item.tanggalExpired,
        status: statusBaru,
        lokasiRak: lokasiBaru,
        qtyMasuk: 0,
        qtyKeluar: 0,
        saldoAkhirLot: item.stockOnhand,
        satuan: clean_(item.satuan),
        idStock: clean_(item.idStock),
        nomorBSTB: clean_(item.nomorBSTB),
        nomorITKirim: clean_(item.nomorITKirim),
        kodeResto: '',
        namaResto: '',
        nomorSuratJalan: '',
        shiftKoordinator: clean_(data.pic),
        namaUserTransaksi: clean_(login.namaUser),
        keterangan: perubahan.join('; ') + '. ' + clean_(data.keterangan),
        nomorBatch: clean_(item.nomorBatch)
      });

      safeSyncRelasiRakBatch_();
      return { ok: true, message: perubahan.join(' dan ') + ' berhasil disimpan. Batch: ' + (item.nomorBatch || '-') + '.' };
  } finally {
    lock.releaseLock();
  }
}


function updateQcFifoStatus(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('NOTICE QC: Ada transaksi stock/status yang sedang diproses user lain. Tunggu beberapa detik lalu simpan ulang agar status tidak bertumbukan.');
  }
  try {
    data = data || {};
    validateRequired_(data, ['idStock', 'statusBaru']);
    const login = validateAuth_(data.auth, 'fifoQc');

    const statusBaruKey = normalizeKey_(data.statusBaru);
    if (['HOLD', 'RELEASE'].indexOf(statusBaruKey) === -1) {
      throw new Error('Menu QC FIFO hanya boleh update status menjadi HOLD atau RELEASE.');
    }

    const stockSheet = getSheet_(CONFIG.sheets.stock);
    const logSheet = getSheet_(CONFIG.sheets.logLokasi);
    const rows = getStockRows_();
    const item = rows.find(function(row) { return sameText_(row.idStock, data.idStock); });
    if (!item) throw new Error('ID Stock tidak ditemukan: ' + data.idStock);
    if (toNumber_(item.stockOnhand) <= 0) throw new Error('Stock onhand lot ini sudah 0 sehingga status QC tidak dapat diupdate dari menu FIFO.');

    const lokasiTetap = clean_(item.lokasiRak);
    const statusLama = clean_(item.status);
    const statusLamaKategori = mapStockDashboardStatus_(statusLama);
    if (statusLamaKategori !== 'HOLD' && statusLamaKategori !== 'RELEASE') {
      throw new Error('Menu QC FIFO hanya bisa mengubah status lot kategori HOLD atau RELEASE. Status saat ini: ' + (statusLama || '-'));
    }
    if (statusLamaKategori === statusBaruKey) {
      throw new Error('Tidak ada perubahan kategori status. Status saat ini sudah termasuk ' + statusBaruKey + '.');
    }
    if ((statusLamaKategori === 'HOLD' && statusBaruKey !== 'RELEASE') || (statusLamaKategori === 'RELEASE' && statusBaruKey !== 'HOLD')) {
      throw new Error('Menu QC FIFO hanya boleh mengubah status HOLD ke RELEASE atau RELEASE ke HOLD.');
    }

    const statusBaru = statusBaruKey;
    const newKey = makeLotKey_(item.namaBarang, item.tanggalProduksi, item.tanggalExpired, statusBaru, lokasiTetap, item.nomorBSTB, item.satuan, item.nomorBatch);
    const existingSameLot = rows.find(function(row) {
      return !sameText_(row.idStock, item.idStock) && String(row.lotKey) === String(newKey) && toNumber_(row.stockOnhand) > 0;
    });
    if (existingSameLot) {
      throw new Error('Update status QC FIFO dibatalkan: lot yang sama sudah ada dengan status ' + statusBaru + ' di Rak ' + lokasiTetap + ' dengan ID Stock ' + existingSameLot.idStock + '.');
    }

    stockSheet.getRange(item.row, 5).setValue(statusBaru);
    stockSheet.getRange(item.row, 14).setValue(new Date());
    stockSheet.getRange(item.row, 15).setValue(newKey);
    stockSheet.getRange(item.row, 16).setValue(clean_(login.namaUser));

    const keterangan = clean_(data.keterangan) || 'Update status melalui menu QC FIFO';
    logSheet.appendRow([
      new Date(),
      clean_(item.idStock),
      clean_(item.namaBarang),
      lokasiTetap,
      lokasiTetap,
      statusLama,
      statusBaru,
      clean_(login.namaUser),
      keterangan,
      clean_(login.namaUser)
    ]);

    logMutasi_({
      jenisMutasi: 'UPDATE_STATUS',
      tanggalTransaksi: new Date(),
      namaBarang: clean_(item.namaBarang),
      tanggalProduksi: item.tanggalProduksi,
      tanggalExpired: item.tanggalExpired,
      status: statusBaru,
      lokasiRak: lokasiTetap,
      qtyMasuk: 0,
      qtyKeluar: 0,
      saldoAkhirLot: item.stockOnhand,
      satuan: clean_(item.satuan),
      idStock: clean_(item.idStock),
      nomorBSTB: clean_(item.nomorBSTB),
      nomorITKirim: clean_(item.nomorITKirim),
      kodeResto: '',
      namaResto: '',
      nomorSuratJalan: '',
      shiftKoordinator: clean_(login.namaUser),
      namaUserTransaksi: clean_(login.namaUser),
      keterangan: 'QC FIFO: Update status dari ' + statusLama + ' ke ' + statusBaru + '. ' + keterangan,
      nomorBatch: clean_(item.nomorBatch)
    });

    safeSyncRelasiRakBatch_();
    return {
      ok: true,
      idStock: clean_(item.idStock),
      statusLama: statusLama,
      statusBaru: statusBaru,
      message: 'Status QC FIFO berhasil diupdate dari ' + statusLama + ' ke ' + statusBaru + '. Batch: ' + (item.nomorBatch || '-') + '. User update: ' + login.namaUser
    };
  } finally {
    lock.releaseLock();
  }
}

function logMutasi_(data) {
  appendRowByHeader_(CONFIG.sheets.mutasiBarang, 'mutasiBarang', [
    new Date(), clean_(data.jenisMutasi), data.tanggalTransaksi || new Date(), clean_(data.namaBarang),
    data.tanggalProduksi || '', data.tanggalExpired || '', clean_(data.status), clean_(data.lokasiRak),
    toNumber_(data.qtyMasuk), toNumber_(data.qtyKeluar), toNumber_(data.saldoAkhirLot), clean_(data.satuan),
    clean_(data.idStock), clean_(data.nomorBSTB), clean_(data.nomorITKirim), clean_(data.kodeResto),
    clean_(data.namaResto), clean_(data.nomorSuratJalan), clean_(data.shiftKoordinator), clean_(data.keterangan),
    clean_(data.namaUserTransaksi || data.shiftKoordinator),
    clean_(data.nomorITTerima),
    data.timestampUpdateIT || '',
    clean_(data.adminUpdateIT),
    clean_(data.nomorBatch)
  ]);
}



function getTimeMotionReport(filter) {
  filter = filter || {};
  validateAuth_(filter.auth, 'supervisor');

  const startFilter = filter.startDate ? startOfDay_(filter.startDate) : null;
  const endFilter = filter.endDate ? endOfDay_(filter.endDate) : null;
  const typeFilter = normalizeKey_(filter.tipe);
  const rows = [];

  function inRange(value) {
    const date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return true;
    if (startFilter && date < startFilter) return false;
    if (endFilter && date > endFilter) return false;
    return true;
  }

  function sameDay_(a, b) {
    if (!a || !b) return false;
    return Utilities.formatDate(a, CONFIG.timezone, 'yyyy-MM-dd') === Utilities.formatDate(b, CONFIG.timezone, 'yyyy-MM-dd');
  }

  if (!typeFilter || typeFilter === 'IN') {
    const sheetIn = getSheet_(CONFIG.sheets.barangMasuk);
    const lastRowIn = sheetIn.getLastRow();
    const lastColIn = sheetIn.getLastColumn();
    const waktuCsColIn = getHeaderColumn_(sheetIn, 'Waktu Masuk CS (Menit)');

    if (lastRowIn >= 2) {
      const valuesIn = sheetIn.getRange(2, 1, lastRowIn - 1, lastColIn).getValues();

      const rawInRows = valuesIn.map(function(row) {
        const timestampInput = row[0] instanceof Date ? row[0] : toDateTime_(row[0]);
        return {
          timestampInput: timestampInput,
          tanggalTransaksi: row[1] || row[0],
          nomorBstb: clean_(row[9]),
          namaBarang: clean_(row[4]),
          qty: row[5],
          satuan: clean_(row[6]),
          koordinator: clean_(row[8]),
          lokasi: clean_(row[10]),
          nomorIt: clean_(row[11]),
          jamIn: row[13] ? clean_(row[13]) : Utilities.formatDate(timestampInput, CONFIG.timezone, 'HH:mm:ss'),
          namaUserTransaksi: clean_(row[14] || row[8]),
          waktuCsMenit: waktuCsColIn ? clean_(row[waktuCsColIn - 1]) : ''
        };
      }).filter(function(item) {
        return inRange(item.tanggalTransaksi);
      }).sort(function(a, b) {
        return a.timestampInput.getTime() - b.timestampInput.getTime();
      });

      rawInRows.forEach(function(item, index) {
        const prev = index > 0 ? rawInRows[index - 1] : null;
        const hasPreviousSameDay = prev && sameDay_(item.timestampInput, prev.timestampInput);
        const waktuCsText = clean_(item.waktuCsMenit);
        let waktuCsManual = '';
        let waktuCsDisplay = '';
        try {
          waktuCsManual = waktuCsText ? durationMinuteSecondToMinutes_(waktuCsText) : '';
          waktuCsDisplay = waktuCsText ? durationMinuteSecondDisplay_(waktuCsText) : '';
        } catch (errDurasi) {
          waktuCsManual = '';
          waktuCsDisplay = '';
        }
        const durasiInterval = hasPreviousSameDay ? calculateDurationMinutes_(prev.timestampInput, item.timestampInput) : '';
        const durasi = waktuCsManual !== '' ? waktuCsManual : durasiInterval;
        const manualCs = waktuCsManual !== '';

        rows.push({
          jenis: 'IN',
          tanggal: dateDisplay_(item.tanggalTransaksi),
          referensi: item.nomorBstb,
          barangResto: item.namaBarang,
          qty: item.qty,
          satuan: item.satuan,
          koordinatorTeam: item.koordinator,
          lokasi: item.lokasi,
          startLabel: 'Jam In',
          endLabel: manualCs ? 'Durasi Masuk CS' : 'Jam In Sebelumnya',
          start: dateTimeDisplay_(item.timestampInput),
          selesai: manualCs ? waktuCsDisplay : (hasPreviousSameDay ? dateTimeDisplay_(prev.timestampInput) : '-'),
          durasiMenit: durasi,
          status: manualCs ? 'TERUKUR MANUAL MASUK CS' : (durasi === '' ? 'AWAL DATA / BELUM ADA PEMBANDING' : 'TERUKUR DARI INTERVAL JAM IN'),
          detail: 'Tanggal BSTB: ' + dateDisplay_(item.tanggalTransaksi) + ' | No BSTB: ' + item.nomorBstb + ' | IT: ' + item.nomorIt + ' | Jam In: ' + item.jamIn + (manualCs ? ' | Waktu CS: ' + waktuCsDisplay : '') + ' | User: ' + item.namaUserTransaksi
        });
      });
    }
  }

  if (!typeFilter || typeFilter === 'OUT') {
    const sheetOut = getSheet_(CONFIG.sheets.otdr);
    const lastRowOut = sheetOut.getLastRow();
    if (lastRowOut >= 2) {
      const valuesOut = sheetOut.getRange(2, 1, lastRowOut - 1, CONFIG.headers.otdr.length).getValues();
      valuesOut.forEach(function(row) {
        const tanggalTransaksi = row[3] || row[0];
        if (!inRange(tanggalTransaksi)) return;

        const start = row[11] || '';
        const selesai = row[12] || '';
        const durasi = start && selesai ? calculateDurationMinutes_(start, selesai) : '';

        rows.push({
          jenis: 'OUT',
          tanggal: dateDisplay_(tanggalTransaksi),
          referensi: clean_(row[6]),
          barangResto: clean_(row[4]) + ' - ' + clean_(row[5]),
          qty: row[16],
          satuan: 'Qty',
          koordinatorTeam: clean_(row[13]),
          lokasi: clean_(row[8]),
          startLabel: 'Start Muat',
          endLabel: 'Selesai Muat',
          start: dateTimeDisplay_(start),
          selesai: dateTimeDisplay_(selesai),
          durasiMenit: durasi,
          status: durasi === ''
            ? (start && selesai ? 'CEK JAM: SELESAI LEBIH AWAL DARI START' : 'BELUM TERUKUR')
            : clean_(row[14] || 'TERUKUR'),
          detail: 'OTDR: ' + clean_(row[2]) + ' | SJ: ' + clean_(row[6]) + ' | Sopir: ' + clean_(row[10]) + ' | User: ' + clean_(row[19] || row[18] || row[13]) + (start && selesai && durasi === '' ? ' | Periksa Start/Selesai Muat' : '')
        });
      });
    }
  }

  rows.sort(function(a, b) {
    return String(b.tanggal).localeCompare(String(a.tanggal));
  });

  const inRows = rows.filter(function(r) { return r.jenis === 'IN' && r.durasiMenit !== ''; });
  const outRows = rows.filter(function(r) { return r.jenis === 'OUT' && r.durasiMenit !== ''; });
  const allMeasured = rows.filter(function(r) { return r.durasiMenit !== ''; });

  return {
    summary: {
      totalInTerukur: inRows.length,
      totalOutTerukur: outRows.length,
      rataInMenit: averageDuration_(inRows),
      rataOutMenit: averageDuration_(outRows),
      rataSemuaMenit: averageDuration_(allMeasured),
      belumTerukur: rows.filter(function(r) { return r.durasiMenit === ''; }).length,
      totalData: rows.length
    },
    rows: rows
  };
}

function averageDuration_(rows) {
  if (!rows || rows.length === 0) return 0;
  const total = rows.reduce(function(sum, row) { return sum + toNumber_(row.durasiMenit); }, 0);
  return Math.round((total / rows.length) * 100) / 100;
}

function calculateDurationMinutes_(startValue, endValue) {
  const start = startValue instanceof Date ? startValue : toDateTime_(startValue);
  const end = endValue instanceof Date ? endValue : toDateTime_(endValue);
  const diffMs = end.getTime() - start.getTime();

  // FIX TIME MOTION:
  // Jangan throw error jika jam selesai lebih awal dari start.
  // Jika throw, seluruh menu TMS gagal tampil.
  // Sekarang dikembalikan kosong agar baris tetap tampil sebagai perlu koreksi jam.
  if (diffMs < 0) return '';

  return Math.round((diffMs / 60000) * 100) / 100;
}

function getMutasiReport(filter) {
  filter = filter || {};
  validateAuth_(filter.auth, 'mutasi');
  const sheet = getSheet_(CONFIG.sheets.mutasiBarang);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.mutasiBarang.length).getValues();
  let rows = values.map(function(row) {
    return {
      timestampInput: row[0], jenisMutasi: row[1], tanggalTransaksi: row[2], namaBarang: row[3],
      tanggalProduksi: row[4], tanggalExpired: row[5], status: row[6], lokasiRak: row[7],
      qtyMasuk: row[8], qtyKeluar: row[9], saldoAkhirLot: row[10], satuan: row[11],
      idStock: row[12], nomorBSTB: row[13], nomorITKirim: row[14], kodeResto: row[15],
      namaResto: row[16], nomorSuratJalan: row[17], shiftKoordinator: row[18], keterangan: row[19], namaUserTransaksi: row[20], nomorBatch: row[24]
    };
  });

  rows = rows.filter(function(item) {
    if (filter.jenisMutasi && !sameText_(item.jenisMutasi, filter.jenisMutasi)) return false;
    if (filter.namaBarang && !sameText_(item.namaBarang, filter.namaBarang)) return false;
    if (filter.status && !sameText_(item.status, filter.status)) return false;
    if (filter.kodeResto && !sameText_(item.kodeResto, filter.kodeResto)) return false;
    const txDate = item.tanggalTransaksi ? new Date(item.tanggalTransaksi) : null;
    if (filter.startDate && txDate && txDate < startOfDay_(filter.startDate)) return false;
    if (filter.endDate && txDate && txDate > endOfDay_(filter.endDate)) return false;
    return true;
  });

  rows.sort(function(a, b) { return new Date(b.timestampInput).getTime() - new Date(a.timestampInput).getTime(); });

  return rows.map(function(item) {
    return {
      timestampInput: dateTimeDisplay_(item.timestampInput), jenisMutasi: item.jenisMutasi,
      tanggalTransaksi: dateDisplay_(item.tanggalTransaksi), namaBarang: item.namaBarang,
      tanggalProduksi: dateDisplay_(item.tanggalProduksi), tanggalExpired: dateDisplay_(item.tanggalExpired),
      status: item.status, lokasiRak: item.lokasiRak, qtyMasuk: item.qtyMasuk, qtyKeluar: item.qtyKeluar,
      saldoAkhirLot: item.saldoAkhirLot, satuan: item.satuan, idStock: item.idStock,
      nomorBSTB: item.nomorBSTB, nomorITKirim: item.nomorITKirim, kodeResto: item.kodeResto,
      namaResto: item.namaResto, nomorSuratJalan: item.nomorSuratJalan,
      shiftKoordinator: item.shiftKoordinator, keterangan: item.keterangan, namaUserTransaksi: item.namaUserTransaksi
    };
  });
}


function getInboundOutboundItemReport(filter) {
  filter = filter || {};
  validateAuth_(filter.auth, 'supervisor');
  ensureSystemReady_();

  const startFilter = filter.startDate ? startOfDay_(filter.startDate) : null;
  const endFilter = filter.endDate ? endOfDay_(filter.endDate) : null;
  if (startFilter && endFilter && startFilter.getTime() > endFilter.getTime()) {
    throw new Error('Tanggal awal tidak boleh lebih besar dari tanggal akhir.');
  }

  const itemFilter = clean_(filter.namaBarang);
  const groups = {};       // Detail per tanggal + item.
  const rangeGroups = {};  // Summary seperti contoh gambar: total item dari tanggal awal sampai akhir.
  const dailyGroups = {};
  let totalInbound = 0;
  let totalOutbound = 0;
  let inboundTransaksi = 0;
  let outboundTransaksi = 0;

  function inDateRange_(tanggalValue) {
    const tanggalObj = toDate_(tanggalValue);
    if (!tanggalObj || isNaN(tanggalObj.getTime())) return false;
    if (startFilter && tanggalObj < startFilter) return false;
    if (endFilter && tanggalObj > endFilter) return false;
    return true;
  }

  function addInOutRow_(args) {
    const tanggalObj = toDate_(args.tanggal);
    if (!tanggalObj || isNaN(tanggalObj.getTime())) return;
    if (!inDateRange_(tanggalObj)) return;

    const namaBarang = clean_(args.namaBarang);
    if (!namaBarang) return;
    if (itemFilter && !sameText_(namaBarang, itemFilter)) return;

    const satuan = clean_(args.satuan) || '-';
    const inbound = toNumber_(args.inboundQty);
    const outbound = toNumber_(args.outboundQty);
    if (inbound <= 0 && outbound <= 0) return;

    const tanggalKey = Utilities.formatDate(tanggalObj, CONFIG.timezone, 'yyyy-MM-dd');
    const tanggalLabel = dateDisplay_(tanggalObj);
    const itemKey = headerKey_(namaBarang) + '||' + headerKey_(satuan);
    const dayItemKey = tanggalKey + '||' + itemKey;

    if (!rangeGroups[itemKey]) {
      rangeGroups[itemKey] = {
        namaBarang: namaBarang,
        satuan: satuan,
        inbound: 0,
        outbound: 0,
        net: 0,
        jumlahTransaksi: 0,
        jumlahTransaksiInbound: 0,
        jumlahTransaksiOutbound: 0
      };
    }
    rangeGroups[itemKey].inbound += inbound;
    rangeGroups[itemKey].outbound += outbound;
    rangeGroups[itemKey].net = rangeGroups[itemKey].inbound - rangeGroups[itemKey].outbound;
    rangeGroups[itemKey].jumlahTransaksi += 1;
    if (inbound > 0) rangeGroups[itemKey].jumlahTransaksiInbound += 1;
    if (outbound > 0) rangeGroups[itemKey].jumlahTransaksiOutbound += 1;

    if (!groups[dayItemKey]) {
      groups[dayItemKey] = {
        tanggalKey: tanggalKey,
        tanggal: tanggalLabel,
        namaBarang: namaBarang,
        satuan: satuan,
        inbound: 0,
        outbound: 0,
        net: 0,
        jumlahTransaksi: 0,
        jumlahTransaksiInbound: 0,
        jumlahTransaksiOutbound: 0
      };
    }

    groups[dayItemKey].inbound += inbound;
    groups[dayItemKey].outbound += outbound;
    groups[dayItemKey].net = groups[dayItemKey].inbound - groups[dayItemKey].outbound;
    groups[dayItemKey].jumlahTransaksi += 1;
    if (inbound > 0) groups[dayItemKey].jumlahTransaksiInbound += 1;
    if (outbound > 0) groups[dayItemKey].jumlahTransaksiOutbound += 1;

    if (!dailyGroups[tanggalKey]) {
      dailyGroups[tanggalKey] = {
        tanggalKey: tanggalKey,
        tanggal: tanggalLabel,
        inbound: 0,
        outbound: 0,
        net: 0,
        totalItem: {},
        jumlahTransaksi: 0
      };
    }
    dailyGroups[tanggalKey].inbound += inbound;
    dailyGroups[tanggalKey].outbound += outbound;
    dailyGroups[tanggalKey].net = dailyGroups[tanggalKey].inbound - dailyGroups[tanggalKey].outbound;
    dailyGroups[tanggalKey].jumlahTransaksi += 1;
    dailyGroups[tanggalKey].totalItem[headerKey_(namaBarang)] = true;

    totalInbound += inbound;
    totalOutbound += outbound;
    if (inbound > 0) inboundTransaksi += 1;
    if (outbound > 0) outboundTransaksi += 1;
  }

  readConfiguredRowsAsObjects_('barangMasuk').forEach(function(row) {
    addInOutRow_({
      tanggal: row['Tanggal Bukti Serah Terima Barang'] || row['Timestamp Input'],
      namaBarang: row['Nama Barang'],
      satuan: row['Satuan'],
      inboundQty: row['Total Qty'],
      outboundQty: 0
    });
  });

  readConfiguredRowsAsObjects_('barangKeluar').forEach(function(row) {
    addInOutRow_({
      tanggal: row['Tanggal Dimuat'] || row['Timestamp Input'],
      namaBarang: row['Nama Barang'],
      satuan: row['Satuan'],
      inboundQty: 0,
      outboundQty: row['Qty Keluar']
    });
  });

  const rangeRows = Object.keys(rangeGroups).map(function(key) {
    return rangeGroups[key];
  }).sort(function(a, b) {
    return String(a.namaBarang).localeCompare(String(b.namaBarang));
  });

  const rows = Object.keys(groups).map(function(key) {
    return groups[key];
  }).sort(function(a, b) {
    const byDate = String(b.tanggalKey).localeCompare(String(a.tanggalKey));
    if (byDate !== 0) return byDate;
    return String(a.namaBarang).localeCompare(String(b.namaBarang));
  });

  const dailyRows = Object.keys(dailyGroups).map(function(key) {
    const row = dailyGroups[key];
    return {
      tanggalKey: row.tanggalKey,
      tanggal: row.tanggal,
      inbound: row.inbound,
      outbound: row.outbound,
      net: row.net,
      totalItem: Object.keys(row.totalItem).length,
      jumlahTransaksi: row.jumlahTransaksi
    };
  }).sort(function(a, b) {
    return String(b.tanggalKey).localeCompare(String(a.tanggalKey));
  });

  const startLabel = startFilter ? dateDisplay_(startFilter) : 'Awal data';
  const endLabel = endFilter ? dateDisplay_(endFilter) : 'Akhir data';

  return {
    summary: {
      totalHari: dailyRows.length,
      totalItemRange: rangeRows.length,
      totalItemTanggal: rows.length,
      totalInbound: totalInbound,
      totalOutbound: totalOutbound,
      totalNet: totalInbound - totalOutbound,
      inboundTransaksi: inboundTransaksi,
      outboundTransaksi: outboundTransaksi,
      startDate: clean_(filter.startDate),
      endDate: clean_(filter.endDate),
      startLabel: startLabel,
      endLabel: endLabel,
      periodeLabel: startLabel + ' s/d ' + endLabel,
      namaBarang: itemFilter,
      sumberData: CONFIG.sheets.barangMasuk + ' + ' + CONFIG.sheets.barangKeluar
    },
    rangeRows: rangeRows,
    dailyRows: dailyRows,
    rows: rows
  };
}

function exportMutasiCsv(filter) {
  const rows = getMutasiReport(filter || {});
  const headers = CONFIG.headers.mutasiBarang;
  const dataRows = rows.map(function(r) {
    return [
      r.timestampInput, r.jenisMutasi, r.tanggalTransaksi, r.namaBarang, r.tanggalProduksi, r.tanggalExpired,
      r.status, r.lokasiRak, r.qtyMasuk, r.qtyKeluar, r.saldoAkhirLot, r.satuan,
      r.idStock, r.nomorBSTB, r.nomorITKirim, r.kodeResto, r.namaResto, r.nomorSuratJalan,
      r.shiftKoordinator, r.keterangan, r.namaUserTransaksi
    ];
  });
  const csv = toCsv_([headers].concat(dataRows));
  const fileName = 'MUTASI_BARANG_' + Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyyMMdd_HHmmss') + '.csv';
  const file = DriveApp.createFile(fileName, csv, MimeType.CSV);
  return { ok: true, fileName: fileName, url: file.getUrl(), totalRows: rows.length };
}



function getRackStockDetailByQr(data) {
  data = data || {};
  validateAuth_(data.auth, 'rackQr');

  const qrText = clean_(data.qrText || data.lokasiRak || '');
  if (!qrText) throw new Error('Nomor rak dari QR Code kosong.');

  // QR dapat berisi langsung "RAK-A1", atau teks panjang seperti "RAK:RAK-A1".
  const lokasiRak = extractRackCodeFromQr_(qrText);
  const rows = getStockRows_().filter(function(item) {
    return sameText_(item.lokasiRak, lokasiRak) && toNumber_(item.stockOnhand) > 0;
  }).sort(function(a, b) {
    const byName = String(a.namaBarang).localeCompare(String(b.namaBarang));
    if (byName !== 0) return byName;
    return new Date(a.tanggalExpired).getTime() - new Date(b.tanggalExpired).getTime();
  });

  const totalQty = rows.reduce(function(sum, item) {
    return sum + toNumber_(item.stockOnhand);
  }, 0);

  return {
    qrText: qrText,
    lokasiRak: lokasiRak,
    totalItem: rows.length,
    totalQty: totalQty,
    rows: rows.map(function(item) {
      return {
        idStock: item.idStock,
        namaBarang: item.namaBarang,
        jumlahItem: item.stockOnhand,
        satuan: item.satuan,
        status: item.status,
        lokasiRak: item.lokasiRak,
        tanggalProduksi: dateDisplay_(item.tanggalProduksi),
        tanggalExpired: dateDisplay_(item.tanggalExpired),
        lastUpdateStock: dateTimeDisplay_(item.lastUpdate),
        nomorBSTB: item.nomorBSTB,
        nomorITKirim: item.nomorITKirim
      };
    })
  };
}

function extractRackCodeFromQr_(text) {
  let value = clean_(text);

  // Format yang didukung:
  // RAK-A1
  // RAK:RAK-A1
  // LOKASI=RAK-A1
  // BARCODE:RAK-A1 atau kode barcode rak yang berisi nomor rak
  // {"rak":"RAK-A1"} sederhana tetap akan dibersihkan jika operator membuat QR/barcode dari teks JSON.
  const jsonRackMatch = value.match(/["']?(?:rak|lokasi|lokasiRak)["']?\s*[:=]\s*["']?([^"',}]+)/i);
  if (jsonRackMatch && jsonRackMatch[1]) {
    value = clean_(jsonRackMatch[1]);
  } else {
    const labelMatch = value.match(/(?:RAK|LOKASI|LOKASI_RAK|LOCATION)\s*[:=]\s*(.+)$/i);
    if (labelMatch && labelMatch[1]) value = clean_(labelMatch[1]);
  }

  return value.toUpperCase();
}

function getDashboardStockCpReport(filter) {
  filter = filter || {};
  validateAuth_(filter.auth);

  const selectedDate = filter.tanggal ? toDate_(filter.tanggal) : new Date();
  const selectedKey = Utilities.formatDate(selectedDate, CONFIG.timezone, 'yyyy-MM-dd');
  const todayKey = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd');

  // Tanggal hari ini memakai STOCK_ONHAND live.
  // Tanggal lampau memakai histori MUTASI_BARANG.
  // Tanggal masa depan dikosongkan agar total tidak tiba-tiba mengikuti stock hari ini.
  const sourceMode = selectedKey === todayKey
    ? 'CURRENT_STOCK'
    : selectedKey < todayKey
      ? 'MUTASI_HISTORY'
      : 'FUTURE_DATE';

  const snapshotRows = sourceMode === 'CURRENT_STOCK'
    ? getCurrentStockSnapshotRows_()
    : sourceMode === 'MUTASI_HISTORY'
      ? getHistoricalStockSnapshotRows_(selectedDate)
      : [];

  const groups = {};
  snapshotRows.forEach(function(item) {
    const qty = toNumber_(item.stockOnhand);
    if (qty <= 0) return;

    const namaBarang = clean_(item.namaBarang);
    const satuan = clean_(item.satuan || 'KARTON').toUpperCase();
    const key = normalizeKey_(namaBarang) + '|' + normalizeKey_(satuan);

    if (!groups[key]) {
      groups[key] = {
        namaBarang: namaBarang,
        satuan: satuan,
        release: 0,
        hold: 0,
        waste: 0,
        total: 0
      };
    }

    const kategori = mapStockDashboardStatus_(item.status);
    if (kategori === 'RELEASE') {
      groups[key].release += qty;
    } else if (kategori === 'HOLD') {
      groups[key].hold += qty;
    } else if (kategori === 'WASTE') {
      groups[key].waste += qty;
    }
  });

  const rows = Object.keys(groups).sort(function(a, b) {
    return String(groups[a].namaBarang).localeCompare(String(groups[b].namaBarang));
  }).map(function(key) {
    const row = groups[key];

    // FIX TOTAL:
    // Total QTY CARTON tidak lagi mengambil angka mentah dari sumber data.
    // Total selalu dihitung dari kolom yang tampil agar tidak berubah sendiri.
    row.release = Math.round(toNumber_(row.release));
    row.hold = Math.round(toNumber_(row.hold));
    row.waste = Math.round(toNumber_(row.waste));
    row.total = row.release + row.hold + row.waste;

    return row;
  });

  const totals = rows.reduce(function(acc, row) {
    acc.release += toNumber_(row.release);
    acc.hold += toNumber_(row.hold);
    acc.waste += toNumber_(row.waste);
    return acc;
  }, { release: 0, hold: 0, waste: 0, total: 0 });

  totals.release = Math.round(totals.release);
  totals.hold = Math.round(totals.hold);
  totals.waste = Math.round(totals.waste);
  totals.total = totals.release + totals.hold + totals.waste;

  return {
    tanggal: selectedKey,
    tanggalLabel: formatDateIndonesian_(selectedDate),
    areaLabel: clean_(filter.areaLabel || 'FG 3'),
    title: clean_(filter.title || 'DAILY STOCK'),
    subTitle: clean_(filter.subTitle || 'STOCK CP3'),
    sourceMode: sourceMode,
    rows: rows,
    totals: totals
  };
}

function getCurrentStockSnapshotRows_() {
  return getFrontendStockRows_({ onlyAvailable: false }).map(function(item) {
    return {
      idStock: item.idStock,
      namaBarang: item.namaBarang,
      satuan: item.satuan,
      status: item.status,
      lokasiRak: item.lokasiRak,
      stockOnhand: item.stockOnhand
    };
  });
}

function getHistoricalStockSnapshotRows_(selectedDate) {
  const sheet = getSheet_(CONFIG.sheets.mutasiBarang);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const end = endOfDay_(selectedDate);
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.mutasiBarang.length).getValues();

  const events = values.map(function(row, index) {
    const timestampInput = row[0];
    const tanggalTransaksi = row[2];
    const refDate = timestampInput || tanggalTransaksi;
    const eventDate = refDate ? new Date(refDate) : null;

    return {
      row: row,
      rowIndex: index,
      eventDate: eventDate
    };
  }).filter(function(item) {
    return item.eventDate && !isNaN(item.eventDate.getTime()) && item.eventDate <= end;
  }).sort(function(a, b) {
    const diff = a.eventDate.getTime() - b.eventDate.getTime();
    if (diff !== 0) return diff;
    return a.rowIndex - b.rowIndex;
  });

  const snapshot = {};

  events.forEach(function(event) {
    const row = event.row;
    const idStock = clean_(row[12]);

    // Jika ID Stock ada, pakai ID Stock agar status/lokasi berubah tidak membuat lot dobel.
    // Jika data lama belum punya ID Stock, pakai fallback key yang stabil.
    const fallbackKey = [
      normalizeKey_(row[3]),       // nama barang
      dateKeySafe_(row[4]),        // tanggal produksi
      dateKeySafe_(row[5]),        // tanggal expired
      normalizeKey_(row[13]),      // nomor BSTB
      normalizeKey_(row[11])       // satuan
    ].join('|');

    const key = idStock || fallbackKey;
    if (!key) return;

    const saldoAkhirLot = toNumber_(row[10]);

    snapshot[key] = {
      idStock: idStock,
      namaBarang: clean_(row[3]),
      satuan: clean_(row[11]),
      status: clean_(row[6]),
      lokasiRak: clean_(row[7]),
      stockOnhand: saldoAkhirLot,
      timestampInput: row[0],
      eventDate: event.eventDate
    };
  });

  return Object.keys(snapshot).map(function(key) {
    return snapshot[key];
  }).filter(function(item) {
    return item.namaBarang && toNumber_(item.stockOnhand) > 0;
  });
}

function mapStockDashboardStatus_(status) {
  const s = normalizeKey_(status);
  if (s === 'HOLD') return 'HOLD';
  if (s === 'WASTE' || s === 'REJECT' || s === 'REJECTED' || s === 'DAMAGED' || s === 'EXPIRED') return 'WASTE';
  return 'RELEASE';
}

function formatDateIndonesian_(value) {
  const date = toDate_(value);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}



function getStockOpnameForm(payload) {
  payload = payload || {};
  const user = validateAuth_(payload.auth || {}, 'stockOpname');
  const filter = payload.filter || {};

  let rows = getStockRows_().filter(function(item) {
    if (filter.onlyAvailable !== false && toNumber_(item.stockOnhand) <= 0) return false;
    if (filter.namaBarang && !sameText_(item.namaBarang, filter.namaBarang)) return false;
    if (filter.status && !sameText_(item.status, filter.status)) return false;
    if (filter.lokasiRak && !sameText_(item.lokasiRak, filter.lokasiRak)) return false;
    return true;
  });

  rows.sort(function(a, b) {
    const byRack = String(a.lokasiRak || '').localeCompare(String(b.lokasiRak || ''));
    if (byRack !== 0) return byRack;
    const byName = String(a.namaBarang || '').localeCompare(String(b.namaBarang || ''));
    if (byName !== 0) return byName;
    return new Date(a.tanggalExpired).getTime() - new Date(b.tanggalExpired).getTime();
  });

  const totalQtySystem = rows.reduce(function(total, item) {
    return total + toNumber_(item.stockOnhand);
  }, 0);

  return {
    generatedAt: dateTimeDisplay_(new Date()),
    generatedDate: dateDisplay_(new Date()),
    generatedBy: user.namaUser,
    role: user.role,
    filters: {
      namaBarang: clean_(filter.namaBarang),
      status: clean_(filter.status),
      lokasiRak: clean_(filter.lokasiRak)
    },
    summary: {
      totalLot: rows.length,
      totalQtySystem: totalQtySystem
    },
    rows: rows.map(function(item, index) {
      return {
        no: index + 1,
        idStock: clean_(item.idStock),
        namaBarang: clean_(item.namaBarang),
        tanggalProduksi: dateDisplay_(item.tanggalProduksi),
        tanggalExpired: dateDisplay_(item.tanggalExpired),
        status: clean_(item.status),
        lokasiRak: clean_(item.lokasiRak),
        qtySystem: toNumber_(item.stockOnhand),
        satuan: clean_(item.satuan),
        nomorBSTB: clean_(item.nomorBSTB),
        tanggalBSTB: dateDisplay_(item.tanggalBSTB),
        namaUserInputTerakhir: clean_(item.namaUserInputTerakhir),
        nomorITKirim: clean_(item.nomorITKirim)
      };
    })
  };
}


function getStockReport(filter) {
  filter = filter || {};
  const groupBy = filter.groupBy || 'namaStatus';
  let rows = getStockRows_().filter(function(item) {
    if (filter.onlyAvailable !== false && toNumber_(item.stockOnhand) <= 0) return false;
    if (filter.namaBarang && !sameText_(item.namaBarang, filter.namaBarang)) return false;
    if (filter.status && !sameText_(item.status, filter.status)) return false;
    if (filter.lokasiRak && !sameText_(item.lokasiRak, filter.lokasiRak)) return false;
    return true;
  });

  const groups = {};
  rows.forEach(function(item) {
    let key;
    if (groupBy === 'namaBarang') key = clean_(item.namaBarang);
    else if (groupBy === 'status') key = clean_(item.status);
    else if (groupBy === 'lokasiRak') key = clean_(item.lokasiRak);
    else key = clean_(item.namaBarang) + ' | ' + clean_(item.status);

    if (!groups[key]) {
      groups[key] = { groupKey: key, totalQtyMasuk: 0, totalQtyKeluar: 0, stockOnhand: 0, totalLot: 0, expiredTerdekat: item.tanggalExpired, satuanList: [] };
    }
    groups[key].totalQtyMasuk += toNumber_(item.qtyMasuk);
    groups[key].totalQtyKeluar += toNumber_(item.qtyKeluar);
    groups[key].stockOnhand += toNumber_(item.stockOnhand);
    groups[key].totalLot += 1;
    if (new Date(item.tanggalExpired).getTime() < new Date(groups[key].expiredTerdekat).getTime()) groups[key].expiredTerdekat = item.tanggalExpired;
    if (groups[key].satuanList.indexOf(clean_(item.satuan)) === -1) groups[key].satuanList.push(clean_(item.satuan));
  });

  return {
    groups: Object.keys(groups).sort().map(function(key) {
      const item = groups[key];
      return {
        groupKey: item.groupKey, totalQtyMasuk: item.totalQtyMasuk, totalQtyKeluar: item.totalQtyKeluar,
        stockOnhand: item.stockOnhand, totalLot: item.totalLot,
        expiredTerdekat: dateDisplay_(item.expiredTerdekat), satuan: item.satuanList.join(', ')
      };
    }),
    details: rows.map(function(item) {
      return {
        idStock: item.idStock, namaBarang: item.namaBarang, tanggalProduksi: dateDisplay_(item.tanggalProduksi),
        tanggalExpired: dateDisplay_(item.tanggalExpired), status: item.status, lokasiRak: item.lokasiRak,
        qtyMasuk: item.qtyMasuk, qtyKeluar: item.qtyKeluar, stockOnhand: item.stockOnhand,
        satuan: item.satuan, nomorBSTB: item.nomorBSTB, nomorITKirim: item.nomorITKirim,
        nomorBatch: item.nomorBatch, namaUserInputTerakhir: item.namaUserInputTerakhir
      };
    })
  };
}

function searchStock(filter) {
  filter = filter || {};
  let rows = getStockRows_();
  if (filter.onlyAvailable) rows = rows.filter(function(item) { return toNumber_(item.stockOnhand) > 0; });
  if (filter.namaBarang) rows = rows.filter(function(item) { return sameText_(item.namaBarang, filter.namaBarang); });
  if (filter.lokasiRak) rows = rows.filter(function(item) { return sameText_(item.lokasiRak, filter.lokasiRak); });
  if (filter.status) rows = rows.filter(function(item) { return sameText_(item.status, filter.status); });
  rows.sort(function(a, b) {
    const byName = String(a.namaBarang).localeCompare(String(b.namaBarang));
    if (byName !== 0) return byName;
    return new Date(a.tanggalExpired).getTime() - new Date(b.tanggalExpired).getTime();
  });
  return rows.map(function(item) {
    return {
      idStock: item.idStock, namaBarang: item.namaBarang, tanggalProduksi: dateDisplay_(item.tanggalProduksi),
      tanggalExpired: dateDisplay_(item.tanggalExpired), status: item.status, lokasiRak: item.lokasiRak,
      qtyMasuk: item.qtyMasuk, qtyKeluar: item.qtyKeluar, stockOnhand: item.stockOnhand,
      satuan: item.satuan, nomorBSTB: item.nomorBSTB, tanggalBSTB: dateDisplay_(item.tanggalBSTB), nomorITKirim: item.nomorITKirim,
      namaUserInputTerakhir: item.namaUserInputTerakhir, nomorBatch: item.nomorBatch, lotKey: item.lotKey
    };
  });
}

function getStockRows_() {
  const sheet = getSheet_(CONFIG.sheets.stock);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.stock.length).getValues();
  return values.map(function(row, index) {
    return {
      row: index + 2, idStock: row[0], namaBarang: row[1], tanggalProduksi: row[2], tanggalExpired: row[3],
      status: row[4], lokasiRak: row[5], qtyMasuk: row[6], qtyKeluar: row[7], stockOnhand: row[8],
      satuan: row[9], nomorBSTB: row[10], tanggalBSTB: row[11], nomorITKirim: row[12], lastUpdate: row[13], lotKey: row[14],
      namaUserInputTerakhir: row[15], nomorITTerima: row[16], lastUpdateITTerima: row[17], adminITTerima: row[18], nomorBatch: row[19]
    };
  }).filter(function(item) { return item.idStock; });
}


function syncRelasiRakBatch_() {
  const sheet = getSheet_(CONFIG.sheets.relasiRakBatch);
  const headers = CONFIG.headers.relasiRakBatch;
  setHeaders_(sheet, headers);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  const now = new Date();
  const rows = getStockRows_()
    .filter(function(item) { return toNumber_(item.stockOnhand) > 0; })
    .sort(function(a, b) {
      const byRack = normalizeKey_(a.lokasiRak).localeCompare(normalizeKey_(b.lokasiRak));
      if (byRack !== 0) return byRack;
      const byBatch = normalizeKey_(a.nomorBatch).localeCompare(normalizeKey_(b.nomorBatch));
      if (byBatch !== 0) return byBatch;
      return String(a.idStock || '').localeCompare(String(b.idStock || ''));
    })
    .map(function(item) {
      return [
        now,
        clean_(item.idStock),
        clean_(item.lotKey),
        clean_(item.lokasiRak),
        clean_(item.nomorBatch),
        clean_(item.namaBarang),
        item.tanggalProduksi || '',
        item.tanggalExpired || '',
        clean_(item.status),
        toNumber_(item.stockOnhand),
        clean_(item.satuan),
        clean_(item.nomorBSTB),
        item.tanggalBSTB || '',
        item.lastUpdate || '',
        clean_(item.namaUserInputTerakhir)
      ];
    });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  return rows.length;
}

function getRelasiRakBatchRows_() {
  const sheet = getSheet_(CONFIG.sheets.relasiRakBatch);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.relasiRakBatch.length).getValues();
  return values.map(function(row) {
    return {
      timestampSync: dateTimeDisplay_(row[0]),
      idStock: clean_(row[1]),
      lotKey: clean_(row[2]),
      lokasiRak: clean_(row[3]),
      nomorBatch: clean_(row[4]),
      namaBarang: clean_(row[5]),
      tanggalProduksi: dateDisplay_(row[6]),
      tanggalExpired: dateDisplay_(row[7]),
      status: clean_(row[8]),
      stockOnhand: toNumber_(row[9]),
      satuan: clean_(row[10]),
      nomorBSTB: clean_(row[11]),
      tanggalBSTB: dateDisplay_(row[12]),
      lastUpdate: dateTimeDisplay_(row[13]),
      namaUserInputTerakhir: clean_(row[14])
    };
  }).filter(function(item) { return item.idStock; });
}

function getRackOccupancy_(lokasiRak, exceptIdStock) {
  const targetRack = normalizeKey_(lokasiRak);
  const exceptId = normalizeKey_(exceptIdStock);
  if (!targetRack) return null;
  return getStockRows_().find(function(item) {
    return normalizeKey_(item.lokasiRak) === targetRack && (exceptId ? normalizeKey_(item.idStock) !== exceptId : true) && toNumber_(item.stockOnhand) > 0;
  }) || null;
}

function findStockRowByKey_(sheet, lotKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const keys = sheet.getRange(2, 15, lastRow - 1, 1).getValues();
  for (let i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(lotKey)) return { row: i + 2 };
  }
  return null;
}

function getStockByLotKey_(lotKey) {
  return getStockRows_().find(function(item) { return String(item.lotKey) === String(lotKey); }) || null;
}

function rebuildMutasiFromExistingData() {
  const mutasiSheet = getSheet_(CONFIG.sheets.mutasiBarang);
  const lastRow = mutasiSheet.getLastRow();
  if (lastRow > 1) mutasiSheet.getRange(2, 1, lastRow - 1, CONFIG.headers.mutasiBarang.length).clearContent();
  safeToast_('Mutasi dikosongkan. Transaksi baru akan tercatat otomatis dengan format baru Kode Resto.', 'Selesai', 7);
}

function getExpiredMonthsByBarang_(namaBarang) {
  const found = readDb_(CONFIG.sheets.dbBarang).find(function(row) { return sameText_(row[0], namaBarang); });
  return found ? toNumber_(found[4]) : 0;
}

function calculateExpiredDate_(tanggalProduksi, expiredBulan) {
  const baseDate = toDate_(tanggalProduksi);
  const months = toNumber_(expiredBulan);
  if (months <= 0) throw new Error('Umur expired bulan belum diisi di DATABASE_BARANG.');
  const targetMonth = baseDate.getMonth() + months;
  const targetDay = baseDate.getDate();
  const firstDayTargetMonth = new Date(baseDate.getFullYear(), targetMonth, 1);
  const lastDayTargetMonth = new Date(firstDayTargetMonth.getFullYear(), firstDayTargetMonth.getMonth() + 1, 0).getDate();
  firstDayTargetMonth.setDate(Math.min(targetDay, lastDayTargetMonth));
  return firstDayTargetMonth;
}

function makeLotKey_(namaBarang, tglProduksi, tglExpired, status, lokasiRak, nomorBSTB, satuan, nomorBatch) {
  const parts = [normalizeKey_(namaBarang), dateKey_(tglProduksi), dateKey_(tglExpired), normalizeKey_(status), normalizeKey_(lokasiRak), normalizeKey_(nomorBSTB), normalizeKey_(satuan)];
  const batchKey = normalizeKey_(nomorBatch);
  if (batchKey) parts.push(batchKey);
  return parts.join('|');
}

function generateStockId_() {
  return 'STK-' + Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function generateOtdrId_() {
  return 'OTDR-' + Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}


function parsePositiveInteger_(value, fieldLabel) {
  const raw = String(value === null || value === undefined ? '' : value).trim();

  // Hanya boleh angka 0-9. Tidak boleh koma, titik, minus, spasi, atau huruf.
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(fieldLabel + ' harus angka bulat. Tidak boleh menggunakan koma/desimal.');
  }

  const num = Number(raw);
  if (num <= 0) {
    throw new Error(fieldLabel + ' harus lebih dari 0.');
  }

  return num;
}

function normalizeDurationMinuteSecond_(value, fieldLabel) {
  const raw = String(value === null || value === undefined ? '' : value).trim();
  if (!raw) return '';

  // Kompatibilitas data lama: angka saja dianggap menit penuh, contoh 15 -> 15:00.
  if (/^[0-9]+$/.test(raw)) {
    const menitOnly = Number(raw);
    if (menitOnly <= 0) throw new Error(fieldLabel + ' harus lebih dari 0 menit/detik.');
    return String(menitOnly) + ':00';
  }

  const match = raw.match(/^([0-9]+):([0-9]{1,2})$/);
  if (!match) {
    throw new Error(fieldLabel + ' harus format menit:detik. Contoh: 3:30, 15:00, atau 0:45.');
  }

  const menit = Number(match[1]);
  const detik = Number(match[2]);
  if (detik < 0 || detik > 59) {
    throw new Error(fieldLabel + ' bagian detik harus 00 sampai 59. Contoh: 3:30, bukan 3:75.');
  }
  if (menit === 0 && detik === 0) {
    throw new Error(fieldLabel + ' harus lebih dari 0 menit/detik.');
  }

  return String(menit) + ':' + String(detik).padStart(2, '0');
}

function durationMinuteSecondToMinutes_(value) {
  const normalized = normalizeDurationMinuteSecond_(value, 'Durasi');
  if (!normalized) return '';
  const parts = normalized.split(':');
  const menit = Number(parts[0]);
  const detik = Number(parts[1]);
  return Math.round((menit + (detik / 60)) * 100) / 100;
}

function durationMinuteSecondDisplay_(value) {
  const normalized = normalizeDurationMinuteSecond_(value, 'Durasi');
  if (!normalized) return '-';
  const parts = normalized.split(':');
  const menit = Number(parts[0]);
  const detik = Number(parts[1]);
  if (detik === 0) return menit + ' menit';
  if (menit === 0) return detik + ' detik';
  return menit + ' menit ' + detik + ' detik';
}

function validateRequired_(data, fields) {
  fields.forEach(function(field) {
    if (data[field] === undefined || data[field] === null || String(data[field]).trim() === '') throw new Error('Field wajib belum diisi: ' + field);
  });
}

function toNumber_(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value || '0').replace(',', '.').replace(/[^0-9.\-]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function clean_(value) { return String(value || '').trim(); }
function sameText_(a, b) { return normalizeKey_(a) === normalizeKey_(b); }
function normalizeKey_(value) { return String(value || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function normalizeLooseKey_(value) { return normalizeKey_(value).replace(/[^A-Z0-9]/g, ''); }
function normalizePoKey_(value) { return normalizeLooseKey_(value).replace(/O/g, '0'); }
function samePoKey_(a, b) {
  const left = normalizeLooseKey_(a);
  const right = normalizeLooseKey_(b);
  if (!left || !right) return false;
  return left === right || normalizePoKey_(left) === normalizePoKey_(right);
}
function containsLooseSearch_(fields, keyword) {
  const kw = normalizeKey_(keyword);
  if (!kw) return true;
  const hayText = normalizeKey_(Array.isArray(fields) ? fields.join(' ') : fields);
  if (hayText.indexOf(kw) !== -1) return true;
  const kwLoose = normalizeLooseKey_(keyword);
  const hayLoose = normalizeLooseKey_(hayText);
  if (kwLoose && hayLoose.indexOf(kwLoose) !== -1) return true;
  const kwPo = normalizePoKey_(keyword);
  const hayPo = normalizePoKey_(hayText);
  return !!(kwPo && hayPo.indexOf(kwPo) !== -1);
}
function isDateInRangeByKey_(value, startValue, endValue) {
  if (!startValue && !endValue) return true;
  const key = dateKeySafe_(value);
  if (!key) return true;
  const startKey = startValue ? dateKeySafe_(startValue) : '';
  const endKey = endValue ? dateKeySafe_(endValue) : '';
  if (startKey && key < startKey) return false;
  if (endKey && key > endKey) return false;
  return true;
}
function pickingSearchFields_(item) {
  return [
    item.nomorPO, item.kodeResto, item.namaResto, item.nomorSuratJalan,
    item.namaBarang, item.idStock, item.nomorBatch, item.lokasiRak, item.nomorBSTB
  ];
}
function pickingKeywordMatches_(item, keyword) {
  if (!keyword) return true;
  if (samePoKey_(item.nomorPO, keyword)) return true;
  return containsLooseSearch_(pickingSearchFields_(item), keyword);
}

function toDate_(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (!value) return '';
  if (typeof value === 'number') {
    // Google Sheets serial date fallback.
    if (value > 1000) return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  m = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new Error('Format tanggal tidak valid: ' + value);
  return date;
}

function toDateTime_(value) {
  if (value instanceof Date) return value;
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new Error('Format tanggal/jam tidak valid: ' + value);
  return date;
}


function dateKeySafe_(value) {
  if (!value) return '';
  try {
    return dateKey_(value);
  } catch (err) {
    return normalizeKey_(value);
  }
}

function dateKey_(value) {
  if (!value) return '';
  return Utilities.formatDate(toDate_(value), CONFIG.timezone, 'yyyy-MM-dd');
}

function dateDisplay_(value) {
  if (!value) return '';
  try { return Utilities.formatDate(toDate_(value), CONFIG.timezone, 'yyyy-MM-dd'); }
  catch (err) { return String(value); }
}

function dateTimeDisplay_(value) {
  if (!value) return '';
  try { return Utilities.formatDate(toDate_(value), CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'); }
  catch (err) { return String(value); }
}

function dateTimeInputDisplay_(value) {
  if (!value) return '';
  try { return Utilities.formatDate(toDate_(value), CONFIG.timezone, "yyyy-MM-dd'T'HH:mm"); }
  catch (err) { return ''; }
}

function startOfDay_(value) {
  const date = toDate_(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay_(value) {
  const date = toDate_(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function toCsv_(rows) {
  return rows.map(function(row) {
    return row.map(function(cell) {
      const value = cell === null || cell === undefined ? '' : String(cell);
      return '"' + value.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n');
}


/**
 * =========================
 * IMPORT STOCK AWAL / MASSAL
 * =========================
 * Template ini dipakai Supervisor untuk import stock awal secara massal.
 * Data template divalidasi terhadap DATABASE_BARANG, DATABASE_STATUS, dan DATABASE_RAK
 * sebelum masuk ke BARANG_MASUK, STOCK_ONHAND, MUTASI_BARANG, dan LOG_IMPORT_STOCK.
 */
function createStockImportTemplate(data) {
  const login = validateAuth_(data && data.auth, 'supervisor');
  const sheet = ensureStockImportTemplateSheet_();
  ensureStockImportLogSheet_();
  applyStockImportTemplateValidation_(sheet);
  return {
    ok: true,
    message: 'Template import stock sudah siap di sheet ' + CONFIG.sheets.stockImportTemplate + '. Isi mulai baris 2, lalu klik Validasi / Import dari menu Supervisor.',
    sheetName: CONFIG.sheets.stockImportTemplate,
    headers: CONFIG.headers.stockImportTemplate,
    user: login.namaUser
  };
}

function getStockImportTemplateInfo(data) {
  validateAuth_(data && data.auth, 'supervisor');
  const sheet = ensureStockImportTemplateSheet_();
  const lastRow = sheet.getLastRow();
  const inputRows = Math.max(0, lastRow - 1);
  return {
    ok: true,
    sheetName: CONFIG.sheets.stockImportTemplate,
    inputRows: inputRows,
    headers: CONFIG.headers.stockImportTemplate,
    message: inputRows ? ('Ditemukan ' + inputRows + ' baris di template.') : 'Template masih kosong. Isi data mulai baris 2 atau upload CSV.'
  };
}

function validateStockImportTemplate(data) {
  validateAuth_(data && data.auth, 'supervisor');
  const validation = validateStockImportTemplate_();
  writeStockImportTemplateResults_(validation.results, false);
  return makeStockImportResponse_(validation, 'VALIDASI');
}

function importStockFromTemplate(data) {
  const login = validateAuth_(data && data.auth, 'supervisor');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let rollbackSnapshot = null;
  let validation = null;
  let importId = '';
  try {
    validation = validateStockImportTemplate_();
    if (validation.errorCount > 0) {
      writeStockImportTemplateResults_(validation.results, false);
      return makeStockImportResponse_(validation, 'GAGAL_VALIDASI');
    }
    if (validation.validCount <= 0) {
      writeStockImportTemplateResults_(validation.results, false);
      return makeStockImportResponse_(validation, 'KOSONG');
    }

    importId = 'IMP-' + Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const now = new Date();
    const masukSheet = getSheet_(CONFIG.sheets.barangMasuk);
    const stockSheet = getSheet_(CONFIG.sheets.stock);
    const logSheet = ensureStockImportLogSheet_();
    const importedResults = [];

    // Snapshot dibuat sebelum CRUD import. Jika ada error di baris mana pun,
    // semua penambahan/update ke database import dikembalikan seperti semula.
    rollbackSnapshot = createStockImportRollbackSnapshot_();

    validation.items.forEach(function(item) {
      try {
        const rowInfo = findStockRowByKey_(stockSheet, item.lotKey);
        let idStock = '';

        masukSheet.appendRow([
          now, item.tanggalBSTB, item.tanggalProduksi, item.tanggalExpired,
          item.namaBarang, item.qty, item.satuan, item.status, item.shiftKoordinator,
          item.nomorBSTB, item.lokasiRak, item.nomorITKirim, item.keterangan, Utilities.formatDate(now, CONFIG.timezone, 'HH:mm:ss'), login.namaUser
        ]);

        if (rowInfo) {
          const row = rowInfo.row;
          idStock = clean_(stockSheet.getRange(row, 1).getValue());
          const oldQtyMasuk = toNumber_(stockSheet.getRange(row, 7).getValue());
          const oldStock = toNumber_(stockSheet.getRange(row, 9).getValue());
          stockSheet.getRange(row, 7).setValue(oldQtyMasuk + item.qty);
          stockSheet.getRange(row, 9).setValue(oldStock + item.qty);
          stockSheet.getRange(row, 13).setValue(item.nomorITKirim);
          stockSheet.getRange(row, 14).setValue(now);
          stockSheet.getRange(row, 16).setValue(login.namaUser);
        } else {
          idStock = generateStockId_();
          stockSheet.appendRow([
            idStock, item.namaBarang, item.tanggalProduksi, item.tanggalExpired,
            item.status, item.lokasiRak, item.qty, 0, item.qty, item.satuan,
            item.nomorBSTB, item.tanggalBSTB, item.nomorITKirim, now, item.lotKey, login.namaUser
          ]);
        }

        const stockAfterIn = getStockByLotKey_(item.lotKey);
        logMutasi_({
          jenisMutasi: 'IN',
          tanggalTransaksi: item.tanggalBSTB,
          namaBarang: item.namaBarang,
          tanggalProduksi: item.tanggalProduksi,
          tanggalExpired: item.tanggalExpired,
          status: item.status,
          lokasiRak: item.lokasiRak,
          qtyMasuk: item.qty,
          qtyKeluar: 0,
          saldoAkhirLot: stockAfterIn ? stockAfterIn.stockOnhand : item.qty,
          satuan: item.satuan,
          idStock: idStock,
          nomorBSTB: item.nomorBSTB,
          nomorITKirim: item.nomorITKirim,
          kodeResto: '',
          namaResto: '',
          nomorSuratJalan: '',
          shiftKoordinator: item.shiftKoordinator,
          namaUserTransaksi: login.namaUser,
          keterangan: item.keterangan
        });

        logSheet.appendRow([
          now, importId, item.rowNumber, item.namaBarang, item.tanggalProduksi, item.tanggalExpired,
          item.status, item.lokasiRak, item.qty, item.satuan, item.nomorBSTB, item.nomorITKirim,
          item.shiftKoordinator, idStock, 'IMPORTED', 'Berhasil import stock.', login.namaUser
        ]);

        importedResults.push({
          rowNumber: item.rowNumber,
          status: 'IMPORTED',
          message: 'Berhasil import stock.',
          idStock: idStock,
          importedAt: now
        });
      } catch (rowErr) {
        throwStockImportRowError_(item.rowNumber, rowErr);
      }
    });

    SpreadsheetApp.flush();

    const finalResultsByRow = {};
    validation.results.forEach(function(result) { finalResultsByRow[result.rowNumber] = result; });
    importedResults.forEach(function(result) { finalResultsByRow[result.rowNumber] = result; });
    const finalResults = Object.keys(finalResultsByRow).map(function(rowNumber) { return finalResultsByRow[rowNumber]; });
    writeStockImportTemplateResults_(finalResults, true);

    return {
      ok: true,
      mode: 'IMPORT',
      importId: importId,
      validCount: validation.validCount,
      errorCount: 0,
      errorRows: [],
      skippedCount: validation.skippedCount,
      totalRows: validation.totalRows,
      importedCount: importedResults.length,
      results: finalResults.sort(function(a, b) { return Number(a.rowNumber) - Number(b.rowNumber); }),
      message: importedResults.length + ' baris berhasil diimport. ID Import: ' + importId
    };
  } catch (err) {
    if (rollbackSnapshot) {
      try {
        restoreStockImportRollbackSnapshot_(rollbackSnapshot);
        SpreadsheetApp.flush();
      } catch (rollbackErr) {
        throw new Error('Import stock gagal dan rollback juga gagal. Cek database manual. Error utama: ' + (err && err.message ? err.message : err) + '. Error rollback: ' + (rollbackErr && rollbackErr.message ? rollbackErr.message : rollbackErr));
      }
    }

    if (validation) {
      const failedResponse = makeStockImportRuntimeFailureResponse_(validation, err, importId);
      writeStockImportTemplateResults_(failedResponse.results, false);
      return failedResponse;
    }

    throw new Error('Import stock dibatalkan. Database tidak dieksekusi / sudah di-rollback. Detail: ' + (err && err.message ? err.message : err));
  } finally {
    lock.releaseLock();
  }
}

function detectCsvDelimiter_(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r\n|\n|\r/).filter(function(line) { return clean_(line); }).slice(0, 10);
  if (!lines.length) return ',';

  const candidates = [',', ';', '\t'];
  let bestDelimiter = ',';
  let bestScore = -1;
  let bestColumns = 1;

  candidates.forEach(function(delimiter) {
    const counts = lines.map(function(line) { return String(line).split(delimiter).length; });
    const maxColumns = Math.max.apply(null, counts);
    const consistentRows = counts.filter(function(count) { return count === maxColumns && count > 1; }).length;
    const score = (maxColumns * 100) + consistentRows;
    if (score > bestScore || (score === bestScore && maxColumns > bestColumns)) {
      bestScore = score;
      bestColumns = maxColumns;
      bestDelimiter = delimiter;
    }
  });

  return bestColumns > 1 ? bestDelimiter : ',';
}

function parseStockImportCsvRows_(csvText) {
  const cleanedText = String(csvText || '').replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter_(cleanedText);
  let rows = Utilities.parseCsv(cleanedText, delimiter);

  // Fallback: jika CSV Excel Indonesia memakai titik koma tetapi terbaca hanya 1 kolom,
  // ulangi parsing dengan delimiter alternatif agar data benar-benar masuk ke template.
  if (rows && rows.length && rows[0].length <= 1) {
    const alternatives = delimiter === ';' ? [',', '\t'] : [';', '\t', ','];
    for (let i = 0; i < alternatives.length; i++) {
      const altRows = Utilities.parseCsv(cleanedText, alternatives[i]);
      if (altRows && altRows.length && altRows[0].length > rows[0].length) {
        rows = altRows;
        break;
      }
    }
  }

  return rows || [];
}

function normalizeStockImportCsvHeader_(header) {
  const key = normalizeKey_(String(header || '').replace(/^\uFEFF/, ''));
  const aliases = {
    'TANGGAL BSTB': 'Tanggal Bukti Serah Terima Barang',
    'TGL BSTB': 'Tanggal Bukti Serah Terima Barang',
    'TANGGAL BUKTI SERAH TERIMA': 'Tanggal Bukti Serah Terima Barang',
    'TANGGAL BUKTI SERAH TERIMA BARANG': 'Tanggal Bukti Serah Terima Barang',
    'TANGGAL PRODUKSI': 'Tanggal Produksi',
    'TGL PRODUKSI': 'Tanggal Produksi',
    'TANGGAL EXPIRED': 'Tanggal Expired (Opsional)',
    'TGL EXPIRED': 'Tanggal Expired (Opsional)',
    'EXPIRED': 'Tanggal Expired (Opsional)',
    'EXP DATE': 'Tanggal Expired (Opsional)',
    'EXPIRY DATE': 'Tanggal Expired (Opsional)',
    'NAMA ITEM': 'Nama Barang',
    'ITEM': 'Nama Barang',
    'BARANG': 'Nama Barang',
    'MATERIAL': 'Nama Barang',
    'QTY': 'Qty Stock Awal',
    'QTY AWAL': 'Qty Stock Awal',
    'STOCK AWAL': 'Qty Stock Awal',
    'STOK AWAL': 'Qty Stock Awal',
    'QTY STOCK AWAL': 'Qty Stock Awal',
    'SATUAN': 'Satuan (Opsional)',
    'UOM': 'Satuan (Opsional)',
    'STATUS': 'Status',
    'LOKASI': 'Lokasi Rak',
    'RAK': 'Lokasi Rak',
    'LOKASI RAK': 'Lokasi Rak',
    'NOMOR BSTB': 'Nomor Bukti Serah Terima Barang',
    'NO BSTB': 'Nomor Bukti Serah Terima Barang',
    'NOMOR BUKTI SERAH TERIMA BARANG': 'Nomor Bukti Serah Terima Barang',
    'NO IT KIRIM': 'Nomor IT Kirim',
    'NOMOR IT KIRIM': 'Nomor IT Kirim',
    'SHIFT': 'Shift / Koordinator',
    'KOORDINATOR': 'Shift / Koordinator',
    'SHIFT KOORDINATOR': 'Shift / Koordinator',
    'KETERANGAN': 'Keterangan',
    'AKSI': 'Aksi'
  };
  return aliases[key] ? normalizeKey_(aliases[key]) : key;
}

function uploadStockImportCsvToTemplate(data) {
  const login = validateAuth_(data && data.auth, 'supervisor');
  const csvText = data && data.csvText ? String(data.csvText) : '';
  if (!csvText.trim()) throw new Error('File CSV kosong atau tidak terbaca.');

  const sheet = ensureStockImportTemplateSheet_();
  const rows = parseStockImportCsvRows_(csvText);
  if (!rows || rows.length === 0) throw new Error('File CSV tidak memiliki data.');

  const templateHeaders = CONFIG.headers.stockImportTemplate;
  const outputStartIndex = templateHeaders.indexOf('Hasil Validasi');
  const firstRow = (rows[0] || []).map(function(value) { return clean_(value); });
  const headerMap = {};
  firstRow.forEach(function(header, index) { headerMap[normalizeStockImportCsvHeader_(header)] = index; });

  const hasHeader = templateHeaders.some(function(header) { return headerMap[normalizeStockImportCsvHeader_(header)] !== undefined; });
  const sourceRows = hasHeader ? rows.slice(1) : rows;
  const mappedRows = sourceRows
    .filter(function(row) { return (row || []).join('').trim() !== ''; })
    .map(function(row) {
      return templateHeaders.map(function(header, index) {
        if (index >= outputStartIndex) return '';
        const csvIndex = hasHeader ? headerMap[normalizeStockImportCsvHeader_(header)] : index;
        return csvIndex === undefined ? '' : (row[csvIndex] || '');
      });
    })
    .filter(function(row) { return row.slice(0, outputStartIndex).join('').trim() !== ''; });

  const maxRowsToClear = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 1, maxRowsToClear, templateHeaders.length).clearContent();

  if (mappedRows.length) {
    if (sheet.getMaxRows() < mappedRows.length + 1) {
      sheet.insertRowsAfter(sheet.getMaxRows(), mappedRows.length + 1 - sheet.getMaxRows());
    }
    sheet.getRange(2, 1, mappedRows.length, templateHeaders.length).setValues(mappedRows);
  }

  applyStockImportTemplateValidation_(sheet);

  return {
    ok: mappedRows.length > 0,
    sheetName: CONFIG.sheets.stockImportTemplate,
    importedCsvRows: mappedRows.length,
    user: login.namaUser,
    message: mappedRows.length
      ? (mappedRows.length + ' baris CSV berhasil dimasukkan ke template. Klik Validasi Data sebelum Import Stock.')
      : 'CSV terbaca, tetapi tidak ada baris data yang masuk ke template. Pastikan file berisi data di bawah header dan delimiter CSV benar.'
  };
}

function ensureStockImportTemplateSheet_() {
  const ss = getInventorySpreadsheet_();
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.stockImportTemplate);
  const headers = CONFIG.headers.stockImportTemplate;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0f766e')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.autoResizeColumns(1, headers.length);
  if (sheet.getMaxRows() < 200) sheet.insertRowsAfter(sheet.getMaxRows(), 200 - sheet.getMaxRows());
  return sheet;
}

function ensureStockImportLogSheet_() {
  const ss = getInventorySpreadsheet_();
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.stockImportLog);
  const headers = CONFIG.headers.stockImportLog;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function applyStockImportTemplateValidation_(sheet) {
  sheet = sheet || ensureStockImportTemplateSheet_();
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const headers = CONFIG.headers.stockImportTemplate;
  const headerIndex = {};
  headers.forEach(function(header, index) { headerIndex[header] = index + 1; });

  const barangList = readDb_(CONFIG.sheets.dbBarang).map(function(row) { return clean_(row[0]); }).filter(String);
  const statusList = readDb_(CONFIG.sheets.dbStatus).map(function(row) { return clean_(row[0]); }).filter(String);
  const rakList = readRackCapacityRows_().map(function(row) { return clean_(row.lokasiRak); }).filter(String);
  const koordinatorList = readDb_(CONFIG.sheets.dbKoordinator).map(function(row) { return row[1] ? clean_(row[0]) + ' - ' + clean_(row[1]) : clean_(row[0]); }).filter(String);

  // FIX: jangan memakai requireValueInList() untuk master data besar.
  // Google Sheets membatasi validasi tipe "Daftar item" maksimal 500 pilihan.
  // Semua dropdown template sekarang diarahkan ke sheet helper tersembunyi
  // dengan requireValueInRange(), sehingga aman walaupun DATABASE_BARANG/RAK/dll > 500 baris.
  const helperSheet = ensureStockImportValidationSourceSheet_();
  const validationSources = [
    { targetHeader: 'Aksi', sourceHeader: 'Aksi', values: ['IMPORT', 'SKIP'] },
    { targetHeader: 'Nama Barang', sourceHeader: 'Nama Barang', values: barangList },
    { targetHeader: 'Status', sourceHeader: 'Status', values: statusList },
    { targetHeader: 'Lokasi Rak', sourceHeader: 'Lokasi Rak', values: rakList },
    { targetHeader: 'Shift / Koordinator', sourceHeader: 'Shift / Koordinator', values: koordinatorList }
  ];

  validationSources.forEach(function(source, index) {
    const sourceRange = writeStockImportValidationSourceColumn_(helperSheet, index + 1, source.sourceHeader, source.values);
    setColumnValidationFromRange_(sheet, headerIndex[source.targetHeader], sourceRange, maxRows);
  });

  sheet.getRange(2, headerIndex['Tanggal Bukti Serah Terima Barang'], maxRows, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, headerIndex['Tanggal Produksi'], maxRows, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, headerIndex['Tanggal Expired (Opsional)'], maxRows, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, headerIndex['Qty Stock Awal'], maxRows, 1).setNumberFormat('0');
}

function ensureStockImportValidationSourceSheet_() {
  const ss = getInventorySpreadsheet_();
  const helperName = '_VALIDASI_STOCK_IMPORT';
  const sheet = getOrCreateSheet_(ss, helperName);
  try {
    if (!sheet.isSheetHidden()) sheet.hideSheet();
  } catch (err) {
    // Jika sheet sedang aktif/terbuka dan belum bisa di-hide, validasi tetap berjalan.
  }
  return sheet;
}

function uniqueValidationValues_(values) {
  const unique = [];
  const seen = {};
  (values || []).forEach(function(value) {
    value = clean_(value);
    const key = normalizeKey_(value);
    if (!key || seen[key]) return;
    seen[key] = true;
    unique.push(value);
  });
  return unique;
}

function writeStockImportValidationSourceColumn_(helperSheet, column, header, values) {
  if (!helperSheet || !column) return null;
  const unique = uniqueValidationValues_(values);

  if (helperSheet.getMaxColumns() < column) {
    helperSheet.insertColumnsAfter(helperSheet.getMaxColumns(), column - helperSheet.getMaxColumns());
  }

  const rowsToClear = Math.max(helperSheet.getMaxRows(), unique.length + 1, 2);
  if (helperSheet.getMaxRows() < rowsToClear) {
    helperSheet.insertRowsAfter(helperSheet.getMaxRows(), rowsToClear - helperSheet.getMaxRows());
  }

  const clearRange = helperSheet.getRange(1, column, rowsToClear, 1);
  clearRange.clearContent();
  clearRange.clearDataValidations();

  helperSheet.getRange(1, column).setValue(header).setFontWeight('bold');
  if (!unique.length) return null;

  helperSheet.getRange(2, column, unique.length, 1).setValues(unique.map(function(value) { return [value]; }));
  return helperSheet.getRange(2, column, unique.length, 1);
}

function setColumnValidationFromRange_(sheet, column, sourceRange, maxRows) {
  if (!sheet || !column || !maxRows) return;
  const targetRange = sheet.getRange(2, column, maxRows, 1);
  targetRange.clearDataValidations();
  if (!sourceRange) return;

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sourceRange, true)
    .setAllowInvalid(true)
    .build();
  targetRange.setDataValidation(rule);
}

function setColumnValidationList_(sheet, column, values, maxRows) {
  if (!sheet || !column || !values || !values.length) return;
  const helperSheet = ensureStockImportValidationSourceSheet_();
  const sourceRange = writeStockImportValidationSourceColumn_(helperSheet, column, 'Dropdown Kolom ' + column, values);
  setColumnValidationFromRange_(sheet, column, sourceRange, maxRows);
}

function validateStockImportTemplate_() {
  const sheet = ensureStockImportTemplateSheet_();
  const lastRow = sheet.getLastRow();
  const headers = CONFIG.headers.stockImportTemplate;
  const totalInputRows = Math.max(0, lastRow - 1);
  if (lastRow < 2) {
    return { totalRows: 0, validCount: 0, errorCount: 0, skippedCount: 0, items: [], results: [] };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const barangMap = buildBarangMasterMap_();
  const statusMap = buildSimpleMasterMap_(CONFIG.sheets.dbStatus, 0);
  const rackMap = buildRackMasterMap_();
  const stockRows = getStockRows_();
  const existingDedicatedRackMap = {};
  const importDedicatedRackMap = {};
  const results = [];
  const items = [];

  stockRows.forEach(function(stock) {
    if (toNumber_(stock.stockOnhand) <= 0) return;
    const rackKey = normalizeKey_(stock.lokasiRak);
    const rackInfo = rackMap[rackKey];
    const jenisRak = rackInfo ? rackInfo.jenisRak : normalizeRackType_('', stock.lokasiRak);
    if (jenisRak !== 'DEDICATED') return;
    if (!existingDedicatedRackMap[rackKey]) existingDedicatedRackMap[rackKey] = [];
    existingDedicatedRackMap[rackKey].push(stock);
  });

  values.forEach(function(row, index) {
    const rowNumber = index + 2;
    const rawInput = row.slice(0, 13);
    if (rawInput.join('').trim() === '') return;

    const action = normalizeKey_(row[0] || 'IMPORT');
    if (action === 'SKIP' || action === 'LEWATI') {
      results.push({ rowNumber: rowNumber, status: 'SKIPPED', message: 'Dilewati sesuai kolom Aksi.', idStock: '' });
      return;
    }

    const errors = [];
    const today = startOfDay_(new Date());
    const namaBarangInput = clean_(row[4]);
    const barangInfo = barangMap[normalizeKey_(namaBarangInput)];
    if (!namaBarangInput) errors.push('Nama Barang wajib diisi.');
    if (namaBarangInput && !barangInfo) errors.push('Nama Barang tidak ada di DATABASE_BARANG: ' + namaBarangInput);

    let tanggalBSTB = row[1] ? safeToDateForImport_(row[1], 'Tanggal Bukti Serah Terima Barang', errors) : today;
    const tanggalProduksi = safeToDateForImport_(row[2], 'Tanggal Produksi', errors);
    let qty = 0;
    try {
      qty = parsePositiveInteger_(row[5], 'Qty Stock Awal');
    } catch (err) {
      errors.push(err.message || String(err));
    }

    const satuan = clean_(row[6]) || (barangInfo ? clean_(barangInfo.satuan) : '');
    if (!satuan) errors.push('Satuan kosong. Isi Satuan atau lengkapi Satuan Default di DATABASE_BARANG.');

    const status = clean_(row[7]) || (barangInfo ? clean_(barangInfo.status) : '');
    if (!status) errors.push('Status kosong. Isi Status atau lengkapi Status Default di DATABASE_BARANG.');
    if (status && !statusMap[normalizeKey_(status)]) errors.push('Status tidak ada di DATABASE_STATUS: ' + status);

    const lokasiRak = clean_(row[8]) || (barangInfo ? clean_(barangInfo.rak) : '');
    if (!lokasiRak) errors.push('Lokasi Rak kosong. Isi Lokasi Rak atau lengkapi Lokasi Rak Default di DATABASE_BARANG.');
    const rackInfo = rackMap[normalizeKey_(lokasiRak)];
    if (lokasiRak && !rackInfo) errors.push('Lokasi Rak tidak ada di DATABASE_RAK: ' + lokasiRak);

    const nomorBSTB = clean_(row[9]) || ('STOCK-AWAL-' + Utilities.formatDate(today, CONFIG.timezone, 'yyyyMMdd'));
    const nomorITKirim = clean_(row[10]);
    const shiftKoordinator = clean_(row[11]) || 'IMPORT STOCK AWAL';
    const keterangan = clean_(row[12]) || 'Import stock awal dari template';
    let tanggalExpired = row[3] ? safeToDateForImport_(row[3], 'Tanggal Expired', errors) : '';

    if (!tanggalExpired && tanggalProduksi && barangInfo) {
      try {
        tanggalExpired = calculateExpiredDate_(tanggalProduksi, barangInfo.expiredBulan);
      } catch (err) {
        errors.push('Tanggal Expired kosong dan Umur Expired (Bulan) di DATABASE_BARANG belum valid untuk ' + namaBarangInput + '.');
      }
    }

    let lotKey = '';
    if (!errors.length && tanggalBSTB && tanggalProduksi && tanggalExpired) {
      lotKey = makeLotKey_(namaBarangInput, tanggalProduksi, tanggalExpired, status, lokasiRak, nomorBSTB, satuan);
      // Multi-batch: rak dedicated juga boleh memiliki lebih dari satu batch/lot aktif.
      // Validasi anti-double sekarang memakai Key Lot, bukan membatasi satu rak hanya satu lot.
    }

    if (errors.length) {
      results.push({ rowNumber: rowNumber, status: 'ERROR', message: errors.join(' | '), idStock: '' });
      return;
    }

    const existingStock = stockRows.find(function(stock) { return String(stock.lotKey) === String(lotKey); });
    items.push({
      rowNumber: rowNumber,
      namaBarang: clean_(barangInfo.nama || namaBarangInput),
      tanggalBSTB: tanggalBSTB,
      tanggalProduksi: tanggalProduksi,
      tanggalExpired: tanggalExpired,
      qty: qty,
      satuan: satuan,
      status: status,
      lokasiRak: lokasiRak,
      nomorBSTB: nomorBSTB,
      nomorITKirim: nomorITKirim,
      shiftKoordinator: shiftKoordinator,
      keterangan: keterangan,
      lotKey: lotKey,
      idStockExisting: existingStock ? existingStock.idStock : ''
    });
    results.push({
      rowNumber: rowNumber,
      status: 'VALID',
      message: existingStock ? ('Valid. Akan menambah stock pada ID existing: ' + existingStock.idStock) : 'Valid. Akan membuat ID Stock baru.',
      idStock: existingStock ? existingStock.idStock : ''
    });
  });

  return {
    totalRows: totalInputRows,
    validCount: items.length,
    errorCount: results.filter(function(result) { return result.status === 'ERROR'; }).length,
    skippedCount: results.filter(function(result) { return result.status === 'SKIPPED'; }).length,
    items: items,
    results: results
  };
}

function makeStockImportResponse_(validation, mode) {
  const errorRows = getStockImportErrorRows_(validation.results);
  const isEmptyTemplate = !validation || !validation.results || validation.results.length === 0 || validation.totalRows <= 0;
  const ok = !isEmptyTemplate && validation.errorCount === 0;
  let message = 'Validasi selesai. Valid: ' + validation.validCount + ', Error: ' + validation.errorCount + ', Skip: ' + validation.skippedCount + '.';
  if (isEmptyTemplate) {
    message = 'Template import masih kosong. Pilih file CSV lalu klik Upload CSV ke Sheet Template, atau klik Validasi Data Template setelah file berhasil diupload otomatis.';
  }
  if (errorRows.length) message += ' Baris error: ' + errorRows.join(', ') + '.';
  if (mode === 'GAGAL_VALIDASI') message = 'Import dibatalkan karena masih ada ' + validation.errorCount + ' baris error. Baris error: ' + errorRows.join(', ') + '. Perbaiki kolom Hasil Validasi di template.';
  if (mode === 'KOSONG') message = 'Tidak ada baris valid untuk diimport. Isi template mulai baris 2 atau upload CSV terlebih dahulu.';
  return {
    ok: ok,
    mode: mode,
    totalRows: validation.totalRows,
    validCount: validation.validCount,
    errorCount: validation.errorCount,
    errorRows: errorRows,
    skippedCount: validation.skippedCount,
    importedCount: 0,
    results: validation.results,
    message: message
  };
}

function createStockImportRollbackSnapshot_() {
  return ['barangMasuk', 'stock', 'mutasiBarang', 'stockImportLog'].map(function(sheetKey) {
    return captureSheetSnapshotForRollback_(sheetKey);
  });
}

function restoreStockImportRollbackSnapshot_(snapshots) {
  restoreBarangKeluarRollbackSnapshot_(snapshots);
}

function throwStockImportRowError_(rowNumber, err) {
  const rawMessage = err && err.message ? err.message : String(err || 'Error tidak diketahui.');
  const messageWithoutDuplicateRow = rawMessage.replace(/^Baris template\s+\d+\s*:\s*/i, '');
  const e = new Error('Baris template ' + rowNumber + ': ' + messageWithoutDuplicateRow);
  e.stockImportRowNumber = rowNumber;
  e.stockImportOriginalMessage = messageWithoutDuplicateRow;
  throw e;
}

function makeStockImportRuntimeFailureResponse_(validation, err, importId) {
  const rowNumber = err && err.stockImportRowNumber ? Number(err.stockImportRowNumber) : '';
  const rawMessage = err && err.message ? err.message : String(err || 'Error tidak diketahui.');
  const cleanMessage = rowNumber ? rawMessage.replace(/^Baris template\s+\d+\s*:\s*/i, '') : rawMessage;
  const resultsByRow = {};
  (validation.results || []).forEach(function(result) {
    resultsByRow[result.rowNumber] = {
      rowNumber: result.rowNumber,
      status: result.status,
      message: result.message,
      idStock: result.idStock || ''
    };
  });

  if (rowNumber) {
    resultsByRow[rowNumber] = {
      rowNumber: rowNumber,
      status: 'ERROR',
      message: 'IMPORT GAGAL pada baris ini. Database sudah di-rollback / tidak jadi dieksekusi. Detail: ' + cleanMessage,
      idStock: ''
    };
  } else {
    resultsByRow['0'] = {
      rowNumber: '-',
      status: 'ERROR',
      message: 'IMPORT GAGAL. Database sudah di-rollback / tidak jadi dieksekusi. Detail: ' + cleanMessage,
      idStock: ''
    };
  }

  const results = Object.keys(resultsByRow).map(function(key) { return resultsByRow[key]; }).sort(function(a, b) {
    return Number(a.rowNumber || 0) - Number(b.rowNumber || 0);
  });
  const errorRows = rowNumber ? [rowNumber] : [];

  return {
    ok: false,
    mode: 'GAGAL_IMPORT',
    importId: importId || '',
    totalRows: validation.totalRows,
    validCount: validation.validCount,
    errorCount: Math.max(1, validation.errorCount || 0),
    errorRows: errorRows,
    skippedCount: validation.skippedCount,
    importedCount: 0,
    results: results,
    message: rowNumber
      ? ('Import dibatalkan pada baris template ' + rowNumber + '. Database sudah di-rollback / tidak jadi dieksekusi. Detail: ' + cleanMessage)
      : ('Import dibatalkan. Database sudah di-rollback / tidak jadi dieksekusi. Detail: ' + cleanMessage)
  };
}

function getStockImportErrorRows_(results) {
  return (results || [])
    .filter(function(result) { return result && result.status === 'ERROR' && result.rowNumber; })
    .map(function(result) { return result.rowNumber; });
}

function getStockImportRowBackground_(result, imported) {
  if (!result || !result.status) return ['#ffffff', '#ffffff', '#ffffff'];
  if (result.status === 'ERROR') return ['#fee2e2', '#fee2e2', '#fee2e2'];
  if (result.status === 'SKIPPED') return ['#fef3c7', '#fef3c7', '#fef3c7'];
  if (result.status === 'IMPORTED' || imported) return ['#dcfce7', '#dcfce7', '#dcfce7'];
  if (result.status === 'VALID') return ['#ecfdf5', '#ecfdf5', '#ecfdf5'];
  return ['#ffffff', '#ffffff', '#ffffff'];
}

function writeStockImportTemplateResults_(results, imported) {
  const sheet = ensureStockImportTemplateSheet_();
  const headers = CONFIG.headers.stockImportTemplate;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const hasilCol = headers.indexOf('Hasil Validasi') + 1;
  const output = [];
  const backgrounds = [];
  for (let i = 2; i <= lastRow; i++) {
    output.push(['', '', '']);
    backgrounds.push(['#ffffff', '#ffffff', '#ffffff']);
  }

  const byRow = {};
  (results || []).forEach(function(result) { byRow[result.rowNumber] = result; });
  Object.keys(byRow).forEach(function(rowNumberText) {
    const rowNumber = Number(rowNumberText);
    if (rowNumber < 2 || rowNumber > lastRow) return;
    const result = byRow[rowNumber];
    const waktu = result.importedAt ? dateTimeDisplay_(result.importedAt) : '';
    output[rowNumber - 2] = [
      'BARIS ' + rowNumber + ' | ' + result.status + ' - ' + result.message,
      waktu,
      result.idStock || ''
    ];
    backgrounds[rowNumber - 2] = getStockImportRowBackground_(result, imported);
  });

  const resultRange = sheet.getRange(2, hasilCol, output.length, 3);
  resultRange.setValues(output);
  resultRange.setBackgrounds(backgrounds);
  sheet.autoResizeColumns(hasilCol, 3);
}

function buildBarangMasterMap_() {
  const map = {};
  readDb_(CONFIG.sheets.dbBarang).forEach(function(row) {
    const nama = clean_(row[0]);
    if (!nama) return;
    map[normalizeKey_(nama)] = {
      nama: nama,
      satuan: clean_(row[1]),
      status: clean_(row[2]),
      rak: clean_(row[3]),
      expiredBulan: toNumber_(row[4])
    };
  });
  return map;
}

function buildSimpleMasterMap_(sheetName, colIndex) {
  const map = {};
  readDb_(sheetName).forEach(function(row) {
    const value = clean_(row[colIndex]);
    if (value) map[normalizeKey_(value)] = value;
  });
  return map;
}

function buildRackMasterMap_() {
  const map = {};
  readRackCapacityRows_().forEach(function(row) {
    const lokasiRak = clean_(row.lokasiRak);
    if (!lokasiRak) return;
    map[normalizeKey_(lokasiRak)] = {
      lokasiRak: lokasiRak,
      kapasitasRak: row.kapasitasRak,
      jenisRak: normalizeRackType_(row.jenisRak, lokasiRak)
    };
  });
  return map;
}

function safeToDateForImport_(value, fieldLabel, errors) {
  if (!value) {
    errors.push(fieldLabel + ' wajib diisi.');
    return '';
  }
  try {
    if (value instanceof Date) return value;
    const raw = clean_(value);

    // Support tanggal serial Excel/Google Sheets dari CSV, contoh 45800.
    if (/^\d+(\.\d+)?$/.test(raw) && Number(raw) > 20000) {
      return new Date(Math.round((Number(raw) - 25569) * 86400 * 1000));
    }

    // Support format Indonesia yang sering muncul dari Excel CSV: dd/mm/yyyy atau dd-mm-yyyy.
    const matchId = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (matchId) {
      const day = Number(matchId[1]);
      const month = Number(matchId[2]);
      const year = Number(matchId[3]);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date;
    }

    return toDate_(value);
  } catch (err) {
    errors.push(fieldLabel + ' tidak valid: ' + value);
    return '';
  }
}


function getDriverDashboardHtml_(token) {
  token = clean_(token);
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { --primary:#1f4e78; --line:#dbe4ef; --text:#1f2937; --muted:#64748b; --success:#16a34a; --warning:#d97706; --danger:#dc2626; }
    * { box-sizing:border-box; }
    body { font-family:Arial,sans-serif; margin:0; padding:14px; color:var(--text); background:linear-gradient(180deg,#eff6ff 0%,#fff 35%); }
    .wrap { max-width:760px; margin:0 auto; }
    .hero { background:linear-gradient(135deg,var(--primary),#0f766e); color:#fff; border-radius:20px; padding:18px; box-shadow:0 10px 28px rgba(15,23,42,.16); }
    .hero h2 { margin:0; font-size:20px; }
    .hero p { margin:6px 0 0; font-size:13px; opacity:.92; line-height:1.45; }
    .card { background:#fff; border:1px solid var(--line); border-radius:18px; padding:14px; margin-top:12px; box-shadow:0 8px 18px rgba(15,23,42,.06); }
    .grid2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .label { font-size:11px; color:var(--muted); font-weight:bold; text-transform:uppercase; }
    .value { font-size:15px; font-weight:800; margin-top:3px; word-break:break-word; }
    label { display:block; font-weight:800; font-size:13px; margin-top:12px; color:#334155; }
    input, select, textarea { width:100%; border:1px solid #cbd5e1; border-radius:12px; padding:11px; margin-top:6px; font-size:15px; background:#fff; }
    textarea { min-height:82px; resize:vertical; }
    button { width:100%; border:0; border-radius:14px; padding:13px; margin-top:14px; background:var(--success); color:white; font-weight:900; font-size:15px; cursor:pointer; }
    button.secondary { background:#475569; }
    table { width:100%; border-collapse:separate; border-spacing:0; font-size:12px; margin-top:8px; }
    th,td { border-bottom:1px solid #e2e8f0; text-align:left; padding:8px 6px; vertical-align:top; }
    th { background:#f1f5f9; font-size:10px; text-transform:uppercase; color:#334155; }
    .badge { display:inline-flex; border-radius:999px; padding:5px 9px; font-size:11px; font-weight:900; background:#fef3c7; color:#92400e; }
    .badge.success { background:#dcfce7; color:#166534; }
    .badge.danger { background:#fee2e2; color:#991b1b; }
    .msg { display:none; margin-top:12px; padding:12px; border-radius:14px; font-size:13px; line-height:1.45; }
    .ok { background:#dcfce7; color:#166534; border:1px solid #86efac; }
    .err { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
    .small { color:var(--muted); font-size:12px; line-height:1.45; margin-top:6px; }
    .empty { border:1px dashed #cbd5e1; background:#f8fafc; color:#64748b; border-radius:14px; padding:14px; text-align:center; margin-top:10px; }
    @media (max-width:640px) { .grid2 { grid-template-columns:1fr; } body { padding:10px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h2>Dashboard Bukti Terima Barang</h2>
      <p>Isi bukti penerimaan setelah barang sampai tujuan. Jika barang diterima dan sesuai, status OTDR otomatis berubah menjadi COMPLETE.</p>
    </div>

    <div id="loading" class="card">Memuat data OTDR...</div>
    <div id="content" style="display:none;">
      <div class="card" id="summary"></div>
      <div class="card">
        <div class="label">Detail Barang Keluar</div>
        <div id="items"></div>
      </div>
      <div class="card">
        <div class="label">Checklist Evidence</div>
        <label>Status Barang</label>
        <select id="statusTerima">
          <option value="SESUAI">Barang diterima dan SESUAI</option>
          <option value="TIDAK SESUAI">Barang diterima tetapi TIDAK SESUAI</option>
        </select>
        <label>Nama Penerima / Perwakilan Tujuan</label>
        <input id="namaPenerima" placeholder="Contoh: Budi / Crew outlet" autocomplete="name">
        <label>Nama Checker</label>
        <input id="namaChecker" placeholder="Contoh: Checker Outlet / Checker Gudang" autocomplete="name">
        <label>Foto Bukti Terima / TTD / Checklist</label>
        <input id="fileBukti" type="file" accept="image/*,.pdf" capture="environment">
        <div class="small">Upload foto surat jalan bertanda tangan, checklist, atau bukti barang diterima. Format foto/PDF disarankan maksimal ±8 MB.</div>
        <label>Catatan</label>
        <textarea id="catatan" placeholder="Contoh: Barang diterima lengkap dan sesuai / ada selisih qty ..."></textarea>
        <button onclick="submitEvidence()">✅ Simpan Bukti Terima</button>
        <button class="secondary" onclick="loadData()">🔄 Refresh</button>
        <div id="msg" class="msg"></div>
      </div>
    </div>
  </div>

<script>
  var TOKEN = ${JSON.stringify(token)};
  var currentData = null;
  document.addEventListener('DOMContentLoaded', loadData);

  function loadData() {
    showLoading('Memuat data OTDR...');
    google.script.run.withSuccessHandler(function(res) {
      currentData = res;
      byId('loading').style.display = 'none';
      byId('content').style.display = 'block';
      renderSummary(res.otdr);
      renderItems(res.items || []);
    }).withFailureHandler(function(err) {
      showLoading('<div class="msg err" style="display:block;">' + escapeHtml(err.message || err) + '</div>');
    }).getDriverDashboardData(TOKEN);
  }

  function renderSummary(o) {
    var cls = String(o.statusOtdr || '').toUpperCase() === 'COMPLETE' ? 'success' : (String(o.statusOtdr || '').indexOf('TIDAK') >= 0 ? 'danger' : '');
    var html = '<div class="grid2">' +
      info('ID OTDR', o.idOtdr) + info('Status OTDR', '<span class="badge ' + cls + '">' + escapeHtml(o.statusOtdr || '-') + '</span>') +
      info('Tanggal Dimuat', o.tanggalDimuat) + info('Nomor Surat Jalan', o.nomorSuratJalan || '-') +
      info('Resto / Tujuan', (o.kodeResto || '-') + ' - ' + (o.namaResto || '-')) + info('Nopol', o.nopol || '-') +
      info('Nama Sopir', o.namaSopir || '-') + info('WA Sopir', o.waSopir || '-') +
      info('Total', (o.totalItem || 0) + ' item / ' + (o.totalQty || 0) + ' qty') + info('Bukti Terakhir', o.linkBuktiFoto ? '<a target="_blank" href="' + escapeAttr(o.linkBuktiFoto) + '">Lihat bukti</a>' : '-') +
      '</div>';
    if (o.statusTerimaSopir) {
      html += '<div class="small" style="margin-top:12px;"><b>Evidence terakhir:</b> ' + escapeHtml(o.statusTerimaSopir) + ' | Penerima: ' + escapeHtml(o.namaPenerima || '-') + ' | Checker: ' + escapeHtml(o.namaChecker || '-') + ' | Waktu: ' + escapeHtml(o.tanggalTerimaSopir || '-') + '</div>';
    }
    byId('summary').innerHTML = html;
  }

  function renderItems(items) {
    if (!items.length) { byId('items').innerHTML = '<div class="empty">Belum ada detail item untuk OTDR ini.</div>'; return; }
    var html = '<table><thead><tr><th>Barang</th><th>Qty</th><th>Lokasi/Exp</th></tr></thead><tbody>';
    items.forEach(function(x) {
      html += '<tr><td><b>' + escapeHtml(x.namaBarang || '-') + '</b><br><span class="small">ID Stock: ' + escapeHtml(x.idStock || '-') + '</span></td><td>' + escapeHtml(x.qtyKeluar || 0) + ' ' + escapeHtml(x.satuan || '') + '</td><td>' + escapeHtml(x.lokasiRak || '-') + '<br><span class="small">Exp: ' + escapeHtml(x.tanggalExpired || '-') + '</span></td></tr>';
    });
    html += '</tbody></table>';
    byId('items').innerHTML = html;
  }

  function submitEvidence() {
    var penerima = val('namaPenerima');
    var checker = val('namaChecker');
    if (!penerima || !checker) { showMsg('Nama penerima dan nama checker wajib diisi.', false); return; }
    var file = byId('fileBukti').files[0];
    if (!file && !(currentData && currentData.otdr && currentData.otdr.linkBuktiFoto)) { showMsg('Foto/dokumen bukti wajib diupload.', false); return; }
    if (file && file.size > 8 * 1024 * 1024) { showMsg('Ukuran file maksimal 8 MB agar dashboard tidak gagal upload.', false); return; }
    showMsg('Mengunggah dan menyimpan bukti...', true);
    if (file) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var base64 = String(e.target.result || '').split(',').pop();
        sendEvidence({ base64: base64, mimeType: file.type || 'image/jpeg', filename: file.name || 'bukti.jpg' });
      };
      reader.onerror = function() { showMsg('File tidak bisa dibaca. Coba foto ulang atau pilih file lain.', false); };
      reader.readAsDataURL(file);
    } else {
      sendEvidence(null);
    }
  }

  function sendEvidence(fileObj) {
    google.script.run.withSuccessHandler(function(res) {
      showMsg(res.message + (res.linkBuktiFoto ? ' Link bukti tersimpan.' : ''), true);
      loadData();
    }).withFailureHandler(function(err) {
      showMsg(err.message || err, false);
    }).submitDriverDeliveryEvidence({
      token: TOKEN,
      statusTerima: val('statusTerima'),
      namaPenerima: val('namaPenerima'),
      namaChecker: val('namaChecker'),
      catatan: val('catatan'),
      file: fileObj,
      userAgent: navigator.userAgent || 'Dashboard Sopir'
    });
  }

  function info(label, value) { return '<div><div class="label">' + escapeHtml(label) + '</div><div class="value">' + value + '</div></div>'; }
  function showLoading(html) { byId('loading').style.display = 'block'; byId('loading').innerHTML = html; byId('content').style.display = 'none'; }
  function showMsg(text, ok) { var el = byId('msg'); el.style.display = 'block'; el.className = 'msg ' + (ok ? 'ok' : 'err'); el.textContent = text; }
  function byId(id) { return document.getElementById(id); }
  function val(id) { var el = byId(id); return el ? el.value.trim() : ''; }
  function escapeHtml(text) { return String(text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function escapeAttr(text) { return escapeHtml(text).replace(/\`/g, '&#096;'); }
</script>
</body>
</html>`;
}


function getInventoryHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <style>
    :root { --primary:#1f4e78; --line:#dbe4ef; --text:#1f2937; --muted:#64748b; --success:#16a34a; --warning:#d97706; --danger:#dc2626; }
    * { box-sizing:border-box; }
    body { font-family:Arial,sans-serif; padding:12px; margin:0; color:var(--text); background:linear-gradient(180deg,#eff6ff 0%,#fff 28%); }
    .header { background:linear-gradient(135deg,var(--primary),#0f766e); color:white; border-radius:18px; padding:16px; margin-bottom:12px; }
    h2 { margin:0; font-size:18px; }
    .subtitle { font-size:11px; opacity:.9; margin-top:4px; }
    .tabs { display:grid; grid-template-columns:repeat(auto-fit,minmax(58px,1fr)); gap:5px; margin-bottom:12px; position:sticky; top:0; background:rgba(255,255,255,.95); padding:6px 0; z-index:10; }
    .tab { border:1px solid var(--line); background:white; border-radius:13px; padding:7px 2px; min-height:55px; font-size:9px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; }
    .tab .ico { font-size:18px; }
    .tab.active { background:var(--primary); color:white; }
    .panel { display:none; }
    .panel.active { display:block; }
    .card { background:white; border:1px solid var(--line); border-radius:16px; padding:11px; margin-bottom:10px; box-shadow:0 8px 18px rgba(15,23,42,.06); }
    .grid2 { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:9px; }
    .metric { font-size:23px; font-weight:800; margin-top:4px; }
    .metric-title { font-size:11px; color:var(--muted); font-weight:bold; }
    .summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:10px; }
    .summary-card { background:#f8fafc; border:1px solid var(--line); border-radius:14px; padding:10px; }
    .summary-card b { display:block; font-size:18px; color:#0f172a; }
    .summary-card span { display:block; margin-top:4px; font-size:10px; color:var(--muted); font-weight:bold; }
    .section-title { display:flex; align-items:center; gap:8px; margin:8px 0 10px; font-weight:800; }
    .section-title span:first-child { width:34px; height:34px; border-radius:12px; background:#eff6ff; display:flex; align-items:center; justify-content:center; }
    label { display:block; margin-top:9px; font-size:12px; font-weight:bold; color:#334155; }
    input, select, textarea { width:100%; padding:9px; margin-top:4px; border:1px solid #cbd5e1; border-radius:11px; background:white; outline:none; }
    textarea { min-height:64px; resize:vertical; }
    button { margin-top:10px; width:100%; padding:11px; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer; }
    button.success { background:var(--success); }
    button.warning { background:var(--warning); }
    button.secondary { background:#475569; }
    button.danger { background:var(--danger); }
    button.mini { width:auto; padding:7px 9px; margin:3px 3px 0 0; border-radius:10px; font-size:10px; display:inline-flex; align-items:center; gap:4px; }
    .action-stack { display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin-top:6px; }
    .proof-link { display:inline-flex; margin-top:5px; font-size:10px; font-weight:800; color:#1f4e78; text-decoration:none; }
    .msg { margin-top:10px; padding:10px; border-radius:12px; display:none; font-size:12px; }
    .ok { background:#dcfce7; color:#166534; border:1px solid #86efac; }
    .err { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
    table { width:100%; border-collapse:separate; border-spacing:0; margin-top:10px; font-size:11px; }
    th, td { border-bottom:1px solid #e2e8f0; padding:8px 7px; text-align:left; vertical-align:top; }
    th { background:#f1f5f9; color:#334155; font-size:10px; text-transform:uppercase; }
    .io-range-wrap { width:100%; overflow-x:auto; border-radius:10px; margin-top:8px; }
    .io-range-table { min-width:720px; border-collapse:collapse; border-spacing:0; font-size:12px; background:#fff; }
    .io-range-table th, .io-range-table td { border:1px solid #111827; padding:10px 8px; vertical-align:middle; }
    .io-range-table thead th { text-align:center; font-size:12px; font-weight:900; letter-spacing:.2px; }
    .io-range-table .th-name, .io-range-table .th-unit { background:#0714f3; color:#ffffff; }
    .io-range-table .th-in { background:#d9ead3; color:#000000; }
    .io-range-table .th-out { background:#ffff00; color:#000000; border-right:7px solid #ff0000; }
    .io-range-table tbody td:nth-child(1) { font-weight:900; color:#000; }
    .io-range-table tbody td:nth-child(2) { text-align:center; }
    .io-range-table tbody td:nth-child(3), .io-range-table tbody td:nth-child(4) { text-align:right; font-weight:900; font-size:13px; }
    .io-range-table .total-row td { background:#000000; color:#ffffff; font-weight:900; }
    .io-range-table .total-row td:nth-child(3), .io-range-table .total-row td:nth-child(4) { font-size:14px; }
    .small { font-size:11px; color:var(--muted); margin-top:6px; line-height:1.4; }
    .badge { display:inline-flex; border-radius:999px; padding:3px 7px; background:#eef2ff; color:#3730a3; font-size:10px; font-weight:bold; }
    .badge.success { background:#dcfce7; color:#166534; }
    .badge.warning { background:#fef3c7; color:#92400e; }
    .badge.danger { background:#fee2e2; color:#991b1b; }
    .empty { padding:14px; text-align:center; color:var(--muted); border:1px dashed #cbd5e1; border-radius:14px; background:#f8fafc; margin-top:10px; }
    .line-card { border:1px solid #e2e8f0; border-radius:14px; padding:10px; margin-top:10px; background:#f8fafc; }
    .resto-search-box { display:grid; grid-template-columns:1fr; gap:6px; margin-top:4px; }
    .resto-search-box input[type=search] { margin-top:0; border:2px solid #bfdbfe; background:#f8fbff; font-weight:700; }
    .resto-search-box select { margin-top:0; }
    .resto-selected-info { background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; padding:8px; }
    .search-select-box { display:grid; grid-template-columns:1fr; gap:6px; margin-top:4px; }
    .search-select-box input[type=search] { margin-top:0; border:2px solid #bfdbfe; background:#f8fbff; font-weight:700; }
    .search-select-box select { margin-top:0; }
    .rack-lastout-info { margin-top:6px; padding:8px 10px; border-radius:10px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:11px; line-height:1.45; display:none; }
    .search-help { display:block; margin-top:4px; font-size:10px; color:#64748b; line-height:1.35; }
    .app-main { display:none; }
    body.logged-in .app-main { display:block; }
    body.logged-in #login_screen { display:none; }
    body:not(.logged-in) { padding:0; min-height:100vh; background:#f7f8ff; }
    #login_screen { display:block; min-height:100vh; margin:0; padding:0; border:0; box-shadow:none; background:#ffffff; border-radius:0; }
    .login-page { min-height:100vh; display:grid; grid-template-columns:minmax(360px, 44%) minmax(420px, 56%); background:#fff; overflow:hidden; }
    .login-left { display:flex; align-items:center; justify-content:center; padding:38px 54px; }
    .login-card-ui { width:100%; max-width:430px; }
    .login-brand { display:flex; align-items:center; gap:9px; margin-bottom:54px; font-size:13px; font-weight:900; color:#151922; letter-spacing:.2px; }
    .login-brand-mark { width:12px; height:12px; border-radius:4px; background:linear-gradient(135deg,#7c3aed,#a855f7); box-shadow:0 6px 14px rgba(124,58,237,.35); }
    .login-title { font-size:42px; line-height:1.08; letter-spacing:-1.2px; font-weight:900; margin:0 0 14px; color:#151922; }
    .login-subtitle { color:#8b93a3; font-size:14px; line-height:1.55; margin:0 0 34px; }
    .login-form-ui { display:flex; flex-direction:column; gap:13px; }
    .login-input-group { position:relative; }
    .login-input-group label { display:block; margin:0 0 7px; font-size:12px; font-weight:900; color:#3b4250; }
    .login-input-group input { height:48px; margin:0; padding:0 46px 0 46px; border:1px solid #e1e5ee; border-radius:12px; background:#ffffff; color:#111827; font-size:14px; box-shadow:0 10px 24px rgba(15,23,42,.035); transition:border-color .2s, box-shadow .2s, transform .2s; }
    .login-input-group input:focus { border-color:#8b5cf6; box-shadow:0 0 0 4px rgba(139,92,246,.12), 0 12px 28px rgba(15,23,42,.08); transform:translateY(-1px); }
    .login-field-icon { position:absolute; left:15px; bottom:13px; width:22px; height:22px; display:flex; align-items:center; justify-content:center; color:#8b5cf6; font-size:15px; }
    .login-eye { position:absolute; right:10px; bottom:8px; width:32px; height:32px; margin:0; padding:0; border-radius:10px; background:transparent; color:#7c8494; font-size:15px; }
    .login-eye:hover { background:#f3f0ff; color:#7c3aed; }
    .login-options { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 14px; font-size:12px; color:#7b8190; }
    .login-check { display:inline-flex; align-items:center; gap:8px; cursor:pointer; user-select:none; }
    .login-check input { width:16px; height:16px; margin:0; accent-color:#7c3aed; }
    .login-help { color:#7c3aed; font-weight:800; text-decoration:none; }
    .login-btn { height:48px; margin:0; width:112px; border-radius:12px; background:linear-gradient(135deg,#7c3aed,#9333ea); box-shadow:0 16px 30px rgba(124,58,237,.28); font-size:14px; transition:transform .18s, box-shadow .18s, opacity .18s; }
    .login-btn:hover { transform:translateY(-1px); box-shadow:0 18px 36px rgba(124,58,237,.35); }
    .login-btn:disabled { opacity:.65; cursor:not-allowed; transform:none; }
    .login-note { margin-top:30px; color:#8992a3; font-size:12px; line-height:1.5; }
    .login-note b { color:#374151; }
    .login-right { min-height:100vh; padding:0; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#7c6ff6 0%,#a855f7 55%,#8b5cf6 100%); position:relative; overflow:hidden; }
    .login-art-wrap { position:relative; width:min(88%, 660px); height:min(86vh, 640px); display:flex; align-items:center; justify-content:center; }
    .login-cloud { position:absolute; background:#fff; opacity:.96; border-radius:999px; filter:drop-shadow(0 18px 24px rgba(46,24,104,.12)); }
    .login-cloud:before, .login-cloud:after { content:''; position:absolute; background:#fff; border-radius:999px; }
    .cloud-1 { width:170px; height:52px; left:-18px; top:28px; transform:rotate(-7deg); }
    .cloud-1:before { width:82px; height:82px; left:22px; bottom:8px; }
    .cloud-1:after { width:64px; height:64px; right:20px; bottom:12px; }
    .cloud-2 { width:185px; height:48px; right:-12px; top:58px; transform:rotate(-6deg); }
    .cloud-2:before { width:102px; height:102px; right:20px; bottom:5px; }
    .cloud-2:after { width:76px; height:76px; left:12px; bottom:6px; }
    .cloud-3 { width:160px; height:42px; right:26px; bottom:74px; transform:rotate(-5deg); }
    .cloud-3:before { width:70px; height:70px; left:24px; bottom:3px; }
    .cloud-3:after { width:54px; height:54px; right:24px; bottom:4px; }
    .phone-card { position:relative; width:230px; height:410px; border-radius:34px; background:#19142f; padding:13px; transform:rotate(10deg); box-shadow:0 30px 60px rgba(28,18,75,.38); z-index:2; }
    .phone-screen { width:100%; height:100%; border-radius:25px; background:linear-gradient(160deg,#f472d0 0%,#a855f7 58%,#7c3aed 100%); position:relative; overflow:hidden; }
    .phone-dot { position:absolute; top:18px; left:50%; width:8px; height:8px; transform:translateX(-50%); background:#151922; border-radius:999px; }
    .phone-line { position:absolute; left:42px; right:42px; height:6px; border-radius:999px; background:rgba(255,255,255,.8); }
    .phone-line.one { bottom:70px; }
    .phone-line.two { bottom:42px; left:64px; right:64px; opacity:.55; }
    .fingerprint { position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); width:118px; height:118px; border-radius:30px; border:4px solid rgba(255,255,255,.85); display:flex; align-items:center; justify-content:center; color:white; font-size:62px; }
    .fingerprint:before, .fingerprint:after { content:''; position:absolute; border:4px solid rgba(255,255,255,.75); border-radius:28px; }
    .fingerprint:before { inset:18px; border-left-color:transparent; }
    .fingerprint:after { inset:36px; border-right-color:transparent; }
    .login-person { position:absolute; z-index:3; left:120px; bottom:96px; width:210px; height:320px; transform:rotate(-5deg); }
    .person-head { position:absolute; left:82px; top:28px; width:42px; height:48px; background:#ffd1b5; border-radius:45% 45% 48% 48%; box-shadow:12px -6px 0 -7px #172554; }
    .person-body { position:absolute; left:45px; top:78px; width:90px; height:115px; background:#ffd12e; border-radius:24px 28px 18px 18px; transform:skewX(-8deg); box-shadow:inset -12px -10px 0 rgba(0,0,0,.06); }
    .person-arm { position:absolute; left:112px; top:100px; width:95px; height:18px; background:#ffd1b5; border-radius:999px; transform:rotate(-17deg); transform-origin:left center; }
    .person-arm:after { content:''; position:absolute; right:-9px; top:-3px; width:22px; height:22px; background:#ffd1b5; border-radius:999px; }
    .person-leg-a { position:absolute; left:66px; top:182px; width:30px; height:112px; background:#fff; border-radius:14px; transform:rotate(14deg); transform-origin:top; }
    .person-leg-b { position:absolute; left:105px; top:184px; width:30px; height:120px; background:#fff; border-radius:14px; transform:rotate(-28deg); transform-origin:top; }
    .person-shoe-a, .person-shoe-b { position:absolute; width:58px; height:24px; background:#111827; border-radius:24px; bottom:10px; }
    .person-shoe-a { left:54px; transform:rotate(12deg); }
    .person-shoe-b { left:132px; transform:rotate(-14deg); }
    .check-bubble { position:absolute; z-index:4; left:42px; top:150px; width:120px; height:74px; background:white; border-radius:50px; box-shadow:0 16px 0 rgba(24,15,54,.18); display:flex; align-items:center; justify-content:center; color:#a855f7; font-size:58px; font-weight:900; }
    .check-bubble:after { content:''; position:absolute; right:-22px; bottom:10px; border-width:14px 0 14px 34px; border-style:solid; border-color:transparent transparent transparent white; }
    .lock-box { position:absolute; z-index:3; right:34px; bottom:190px; width:112px; height:104px; background:white; border-radius:22px; box-shadow:0 20px 34px rgba(34,20,88,.18); }
    .lock-box:before { content:''; position:absolute; left:30px; top:-45px; width:52px; height:52px; border:13px solid white; border-bottom:0; border-radius:30px 30px 0 0; }
    .lock-box:after { content:''; position:absolute; left:50%; top:42px; width:18px; height:18px; transform:translateX(-50%); border-radius:999px; background:linear-gradient(135deg,#a855f7,#7c3aed); box-shadow:0 16px 0 -5px #7c3aed; }
    .login-floating-text { position:absolute; left:30px; bottom:24px; color:rgba(255,255,255,.82); font-size:12px; font-weight:700; letter-spacing:.2px; }
    .login-msg-wrap .msg { margin-top:18px; }
    .user-box { margin-top:10px; padding:9px; border-radius:12px; background:rgba(255,255,255,.16); font-size:12px; display:flex; justify-content:space-between; gap:8px; align-items:center; }
    .user-box button { width:auto; margin:0; padding:6px 10px; background:rgba(255,255,255,.2); border:1px solid rgba(255,255,255,.28); }
    @media (max-width:900px) {
      .login-page { grid-template-columns:1fr; }
      .login-left { padding:34px 22px; min-height:100vh; }
      .login-brand { margin-bottom:34px; }
      .login-title { font-size:34px; }
      .login-right { display:none; }
      .login-btn { width:100%; }
    }



    .form-table-wrap { width:100%; overflow:auto; border:1px solid var(--line); border-radius:16px; margin-top:10px; background:white; }
    table.form-table { margin-top:0; border-collapse:separate; border-spacing:0; min-width:900px; font-size:12px; }
    .form-table th { position:sticky; top:0; z-index:1; background:#eaf2fb; color:#0f172a; font-size:11px; text-transform:none; border-bottom:2px solid #cbd5e1; }
    .form-table th:nth-child(1), .form-table td:nth-child(1) { width:70px; text-align:center; font-weight:900; color:#1f4e78; }
    .form-table th:nth-child(2), .form-table td:nth-child(2) { width:230px; }
    .form-table th:nth-child(3), .form-table td:nth-child(3) { width:390px; }
    .form-table th:nth-child(4), .form-table td:nth-child(4) { width:310px; }
    .form-table td { background:#fff; vertical-align:middle; }
    .form-table tr:nth-child(even) td { background:#f8fafc; }
    .form-table input, .form-table select, .form-table textarea { margin-top:0; font-size:14px; font-weight:600; }
    .form-table textarea { min-height:70px; }
    .field-name { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-weight:900; color:#0f172a; }
    .field-sub { display:block; color:#64748b; font-size:11px; margin-top:3px; line-height:1.35; }
    .req-pill { display:inline-flex; align-items:center; border-radius:999px; padding:2px 7px; background:#fee2e2; color:#991b1b; font-size:9px; font-weight:900; }
    .auto-pill { display:inline-flex; align-items:center; border-radius:999px; padding:2px 7px; background:#dcfce7; color:#166534; font-size:9px; font-weight:900; }
    .hint-awam { color:#475569; line-height:1.45; font-size:12px; }
    .masuk-help-box { background:#eff6ff; border:1px solid #bfdbfe; color:#1e3a8a; border-radius:14px; padding:10px; margin-top:8px; font-size:12px; line-height:1.45; }
    .masuk-action-grid { display:grid; grid-template-columns:1fr 220px; gap:10px; align-items:center; margin-top:12px; }
    .masuk-action-grid button { margin-top:0; }
    @media (max-width:720px) {
      table.form-table { min-width:760px; }
      .masuk-action-grid { grid-template-columns:1fr; }
    }
    table.admin-it-table { min-width:1350px; }
    .admin-it-table th:nth-child(1), .admin-it-table td:nth-child(1) { width:55px; text-align:center; }
    .admin-it-table th:nth-child(2), .admin-it-table td:nth-child(2) { width:145px; }
    .admin-it-table th:nth-child(3), .admin-it-table td:nth-child(3) { width:150px; }
    .admin-it-table th:nth-child(4), .admin-it-table td:nth-child(4), .admin-it-table th:nth-child(5), .admin-it-table td:nth-child(5) { width:170px; }
    .admin-it-table th:nth-child(6), .admin-it-table td:nth-child(6) { width:170px; }
    .admin-it-table th:nth-child(7), .admin-it-table td:nth-child(7), .admin-it-table th:nth-child(8), .admin-it-table td:nth-child(8) { width:210px; }
    .admin-it-table th:nth-child(9), .admin-it-table td:nth-child(9) { width:95px; }
    .admin-it-table th:nth-child(10), .admin-it-table td:nth-child(10) { width:200px; }
    .admin-it-table th:nth-child(11), .admin-it-table td:nth-child(11) { width:90px; text-align:center; }

    .stockcp-card { padding:0; overflow:hidden; border:2px solid #111827; }
    .stockcp-toolbar { padding:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#fff7d6; border-bottom:1px solid #111827; }
    .stockcp-toolbar label { margin-top:0; font-size:11px; color:#111827; }
    .stockcp-toolbar input, .stockcp-toolbar select { margin-top:3px; font-weight:700; text-align:center; }
    .stockcp-titlebar { display:grid; grid-template-columns:2fr 1fr 2fr; align-items:center; background:#ffe8aa; border-bottom:1px solid #111827; }
    .stockcp-titlebar div { padding:6px 8px; border-right:1px solid #d6bd77; font-size:18px; font-weight:900; text-align:center; color:#000; }
    .stockcp-titlebar div:last-child { border-right:none; }
    .stockcp-area-select { background:#9bd7b4; border-radius:6px; padding:3px 10px; display:inline-block; min-width:72px; font-size:16px; }
    .stockcp-subtitle { text-align:center; font-weight:900; font-size:13px; padding:4px; background:#ffffff; color:#000; border-bottom:1px solid #111827; }
    .stockcp-table-wrap { width:100%; overflow:auto; max-height:420px; background:white; }
    table.stockcp-table { margin-top:0; border-collapse:collapse; min-width:650px; font-size:12px; }
    .stockcp-table th, .stockcp-table td { border:1px solid #111827; padding:6px 4px; vertical-align:middle; color:#000; }
    .stockcp-table th { text-align:center; font-weight:900; color:#fff; font-size:13px; }
    .stockcp-table th.name-head, .stockcp-table th.satuan-head, .stockcp-table th.total-head { background:#001aff; }
    .stockcp-table th.release-head { background:#d9ead3; color:#000; }
    .stockcp-table th.hold-head { background:#ffff00; color:#000; }
    .stockcp-table th.waste-head { background:#ff0000; color:#fff; }
    .stockcp-table td.nama { font-weight:700; }
    .stockcp-table td.satuan { text-align:center; font-size:11px; }
    .stockcp-table td.num { text-align:right; font-weight:900; font-size:13px; }
    .stockcp-table tfoot td { background:#000; color:#fff; font-weight:900; font-size:14px; }
    .stockcp-note { padding:8px 10px; font-size:11px; color:#475569; background:#f8fafc; border-top:1px solid #dbe4ef; }
    @media (max-width:520px) {
      .stockcp-toolbar { grid-template-columns:1fr; }
      .stockcp-titlebar { grid-template-columns:1fr; }
      .stockcp-titlebar div { border-right:none; border-bottom:1px solid #d6bd77; font-size:16px; }
    }


    .qr-scan-box { border:2px dashed #94a3b8; border-radius:16px; padding:10px; background:#f8fafc; margin-top:10px; }
    #qr_reader { width:100%; min-height:240px; border-radius:14px; overflow:hidden; background:#000; }
    .qr-result-header { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin-top:10px; }
    .qr-summary-card { background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px; padding:10px; }
    .qr-summary-card b { display:block; font-size:16px; color:#0f172a; margin-top:3px; }
    @media (max-width: 420px) {
      .qr-result-header { grid-template-columns:1fr; }
    }


    .camera-help { background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; border-radius:12px; padding:10px; margin-top:10px; font-size:11px; line-height:1.45; }
    .qr-upload { border:1px solid #cbd5e1; border-radius:12px; padding:10px; background:white; margin-top:10px; }


    .qr-mode-box { border:1px solid #cbd5e1; border-radius:12px; padding:10px; background:#ffffff; margin-top:10px; }
    .qr-mode-title { font-weight:800; color:#0f172a; margin-bottom:4px; }


    .occ-filter { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
    .occ-actions { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px; }
    .occ-summary { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; margin-top:10px; }
    .occ-card { border:1px solid #dbe4ef; background:#f8fafc; border-radius:14px; padding:10px; }
    .occ-card .metric { font-size:20px; }
    .occ-chart-wrap { margin-top:10px; border:1px solid #dbe4ef; border-radius:14px; padding:10px; background:white; overflow:hidden; }
    #occ_chart_canvas { width:100%; height:280px; display:block; }
    .occ-legend { display:flex; flex-wrap:wrap; gap:10px; font-size:11px; color:#475569; margin-top:8px; }
    .occ-legend span { display:inline-flex; align-items:center; gap:5px; }
    .occ-dot { width:11px; height:11px; border-radius:999px; display:inline-block; }
    .occ-release { background:#2563eb; }
    .occ-hold { background:#ef4444; }
    .occ-total { background:#eab308; }
    .rack-capacity-table input { width:90px; padding:6px; border-radius:8px; text-align:right; font-weight:800; }
    @media (max-width:520px) {
      .occ-filter, .occ-actions, .occ-summary { grid-template-columns:1fr; }
    }

    .stockopname-filter { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
    .stockopname-actions { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px; }
    .stockopname-doc { background:white; color:#111827; padding:10px; border:1px solid #111827; border-radius:12px; margin-top:10px; }
    .stockopname-head { display:grid; grid-template-columns:1.4fr .8fr .8fr; gap:8px; border-bottom:2px solid #111827; padding-bottom:8px; margin-bottom:8px; align-items:start; }
    .stockopname-title { font-size:18px; font-weight:900; letter-spacing:.5px; text-align:center; }
    .stockopname-meta { font-size:11px; line-height:1.45; }
    .stockopname-summary { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin:8px 0; }
    .stockopname-summary div { border:1px solid #111827; padding:6px; border-radius:8px; font-size:11px; }
    .stockopname-table { border-collapse:collapse; width:100%; font-size:10px; margin-top:8px; }
    .stockopname-table th, .stockopname-table td { border:1px solid #111827; padding:5px 4px; color:#111827; }
    .stockopname-table th { background:#e2e8f0; text-align:center; font-size:9px; }
    .stockopname-table td.num { text-align:right; font-weight:800; }
    .stockopname-table td.center { text-align:center; }
    .op-actual { min-width:58px; padding:4px; border-radius:5px; text-align:right; font-weight:800; }
    .op-status { font-weight:900; }
    .op-status.ok { color:#166534; }
    .op-status.ng { color:#991b1b; }
    .op-sign { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; margin-top:18px; text-align:center; font-size:11px; }
    .op-sign-box { border:1px solid #111827; border-radius:8px; padding:8px; min-height:80px; display:flex; flex-direction:column; justify-content:space-between; }
    @media (max-width:520px) {
      .stockopname-filter, .stockopname-actions, .stockopname-head, .stockopname-summary, .op-sign { grid-template-columns:1fr; }
    }
    @media print {
      body.printing-stockopname { background:white !important; padding:0 !important; }
      body.printing-stockopname * { visibility:hidden !important; }
      body.printing-stockopname #stockopname_print_area, body.printing-stockopname #stockopname_print_area * { visibility:visible !important; }
      body.printing-stockopname #stockopname_print_area { position:absolute; left:0; top:0; width:100%; }
      body.printing-stockopname #stockopname_print_area .stockopname-doc { border:none; border-radius:0; margin:0; padding:0; box-shadow:none; }
      body.printing-stockopname .no-print { display:none !important; }
      body.printing-stockopname .stockopname-table { font-size:9px; }
      body.printing-stockopname .stockopname-table th { background:#e5e7eb !important; color:#000 !important; }
      body.printing-stockopname .op-actual { border:1px solid #000; }
    }

  </style>
</head>
<body>

  <div id="login_screen" class="login-shell">
    <div class="login-page">
      <div class="login-left">
        <div class="login-card-ui">
          <div class="login-brand"><span class="login-brand-mark"></span><span>OTDR Inventory</span></div>
          <h1 class="login-title">Hallo,<br>Welcome Back</h1>
          <p class="login-subtitle">Masuk ke dashboard inventory, OTDR, admin IT, stock opname, dan laporan warehouse.</p>

          <div class="login-form-ui">
            <div class="login-input-group">
              <label for="login_username">Username</label>
              <span class="login-field-icon">👤</span>
              <input type="text" id="login_username" autocomplete="username" placeholder="Contoh: in1 / out1 / qc / spv">
            </div>

            <div class="login-input-group">
              <label for="login_password">Password</label>
              <span class="login-field-icon">🔒</span>
              <input type="password" id="login_password" autocomplete="current-password" placeholder="Masukkan password">
              <button type="button" class="login-eye" onclick="togglePassword()" title="Tampilkan / sembunyikan password">👁️</button>
            </div>

            <div class="login-options">
              <label class="login-check"><input type="checkbox" id="remember_login" checked> Remember me</label>
              <span class="login-help">Hubungi Admin jika lupa password</span>
            </div>

            <button id="login_btn" type="button" class="login-btn" onclick="doLogin()">Sign In</button>
          </div>

          <div class="login-note">Gunakan akun dari sheet <b>DATABASE_USER</b>. Sistem otomatis mengecek dan memperbaiki relasi sheet saat login agar menu tidak error.</div>
          <div class="login-msg-wrap"><div id="msg_login" class="msg"></div></div>
        </div>
      </div>

      <div class="login-right" aria-hidden="true">
        <div class="login-art-wrap">
          <div class="login-cloud cloud-1"></div>
          <div class="login-cloud cloud-2"></div>
          <div class="login-cloud cloud-3"></div>
          <div class="check-bubble">✓</div>
          <div class="phone-card">
            <div class="phone-screen">
              <div class="phone-dot"></div>
              <div class="fingerprint">⌾</div>
              <div class="phone-line one"></div>
              <div class="phone-line two"></div>
            </div>
          </div>
          <div class="login-person">
            <div class="person-head"></div>
            <div class="person-body"></div>
            <div class="person-arm"></div>
            <div class="person-leg-a"></div>
            <div class="person-leg-b"></div>
            <div class="person-shoe-a"></div>
            <div class="person-shoe-b"></div>
          </div>
          <div class="lock-box"></div>
          <div class="login-floating-text">Secure access for warehouse operation</div>
        </div>
      </div>
    </div>
  </div>

  <div id="app_main" class="app-main">
  <div class="header">
    <h2>🏭 Dashboard Inventory</h2>
    <div class="subtitle">Barang Masuk • Barang Keluar Multiple • Admin IT • OTDR • QC FIFO</div>
    <div class="user-box"><span id="current_user_label">Belum login</span><button onclick="doLogout()">Logout</button></div>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="openTab('dashboard', this)"><span class="ico">📊</span><span>Dash</span></div>
    <div class="tab" onclick="openTab('masuk', this)"><span class="ico">📥</span><span>Masuk</span></div>
    <div class="tab" onclick="openTab('keluar', this)"><span class="ico">🚚</span><span>Keluar</span></div>
    <div class="tab" onclick="openTab('adminit', this)"><span class="ico">🧾</span><span>Admin IT</span></div>
    <div class="tab" onclick="openTab('otdr', this)"><span class="ico">⏱️</span><span>OTDR</span></div>
    <div class="tab" onclick="openTab('lokasi', this)"><span class="ico">🧭</span><span>Lokasi</span></div>
    <div class="tab" onclick="openTab('stock', this)"><span class="ico">📦</span><span>Stock</span></div>
    <div class="tab" onclick="openTab('fifoqc', this)"><span class="ico">✅</span><span>QC FIFO</span></div>
    <div class="tab" onclick="openTab('importstock', this)"><span class="ico">⬆️</span><span>Import</span></div>
    <div class="tab" onclick="openTab('occupancy', this)"><span class="ico">📈</span><span>Okupansi</span></div>
    <div class="tab" onclick="openTab('stockopname', this)"><span class="ico">📝</span><span>Opname</span></div>
    <div class="tab" onclick="openTab('mutasi', this)"><span class="ico">📜</span><span>Mutasi</span></div>
    <div class="tab" onclick="openTab('report', this)"><span class="ico">📑</span><span>Report</span></div>
    <div class="tab" onclick="openTab('rackqr', this)"><span class="ico">📷</span><span>Scan Rak</span></div>
    <div class="tab" onclick="openTab('timemotion', this)"><span class="ico">⏱️</span><span>Time</span></div>
  </div>

  <div id="dashboard" class="panel active">
    <div class="grid2">
      <div class="card"><div class="metric-title">Total Stock</div><div class="metric" id="dash_total_qty">0</div><div class="small">Qty onhand</div></div>
      <div class="card"><div class="metric-title">Total Lot</div><div class="metric" id="dash_total_lot">0</div><div class="small">Batch tersedia</div></div>
      <div class="card"><div class="metric-title">Exp ≤ 30 Hari</div><div class="metric" id="dash_exp_soon">0</div><div class="small">Prioritas FEFO</div></div>
      <div class="card"><div class="metric-title">OTDR Belum Lengkap</div><div class="metric" id="dash_otdr_pending">0</div><div class="small">Perlu update loading</div></div>
    </div>

    <div class="card stockcp-card">
      <div class="stockcp-toolbar">
        <div>
          <label>Cek Stock Per Tanggal</label>
          <input type="date" id="dash_stock_date" onchange="loadDashboardStockCpReport()">
        </div>
        <div>
          <label>Area / Group</label>
          <select id="dash_stock_area" onchange="loadDashboardStockCpReport()">
            <option value="FG 3">FG 3</option>
            <option value="FG 1">FG 1</option>
            <option value="FG 2">FG 2</option>
            <option value="CP3">CP3</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
      </div>
      <div id="dash_stockcp_table">
        <div class="empty">Memuat report stock...</div>
      </div>
      <div class="stockcp-note">
        Kolom RELEASE mencakup status RELEASE/GOOD. Kolom WASTE mencakup WASTE/REJECT/DAMAGED/EXPIRED.
      </div>
    </div>

    <div class="card"><div class="section-title"><span>⚠️</span><div>Prioritas Expired Terdekat</div></div><div id="dash_exp_table"></div></div>
  </div>

  <div id="masuk" class="panel">
    <div class="card">
      <div class="section-title"><span>📥</span><div>Form Barang Masuk - Tampilan Tabel Mudah</div></div>
      <div class="masuk-help-box">
        Isi data dari nomor 1 sampai 16. Kolom <b>Isi di sini</b> adalah tempat operator mengetik/memilih data. Kolom <b>Petunjuk</b> menjelaskan maksud field agar mudah dipahami orang awam.
      </div>
      <div class="form-table-wrap">
        <table class="form-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Data yang Dibutuhkan</th>
              <th>Isi di Sini</th>
              <th>Petunjuk untuk Operator</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td><div class="field-name">Tanggal Barang Diterima <span class="req-pill">WAJIB</span></div><span class="field-sub">Tanggal BSTB</span></td>
              <td><input type="date" id="in_tanggalBSTB"></td>
              <td><div class="hint-awam">Isi sesuai tanggal pada dokumen BSTB / tanggal barang datang ke gudang.</div></td>
            </tr>
            <tr>
              <td>2</td>
              <td><div class="field-name">Jam Input Barang <span class="auto-pill">OTOMATIS</span></div><span class="field-sub">Jam In real time</span></td>
              <td><input type="text" id="in_jamIn" readonly></td>
              <td><div class="hint-awam">Tidak perlu diketik. Sistem mengisi jam otomatis saat transaksi disimpan.</div></td>
            </tr>
            <tr>
              <td>3</td>
              <td><div class="field-name">Waktu Masuk CS <span class="req-pill">MM:SS</span></div><span class="field-sub">Durasi barang dimasukkan ke CS</span></td>
              <td><input type="text" id="in_waktuCSMenit" inputmode="numeric" autocomplete="off" placeholder="Contoh: 03:30" oninput="normalizeMinuteSecondInput(this)" onblur="normalizeMinuteSecondBlur(this)" onpaste="setTimeout(function(){ normalizeMinuteSecondInput(document.getElementById('in_waktuCSMenit')); }, 0)"></td>
              <td><div class="hint-awam">Isi format menit:detik untuk durasi proses dari barang diterima sampai dimasukkan ke CS/Cold Storage. Contoh 03:30 berarti 3 menit 30 detik. Kosongkan jika belum diukur.</div></td>
            </tr>
            <tr>
              <td>4</td>
              <td><div class="field-name">Tanggal Produksi</div><span class="field-sub">Tanggal produk dibuat</span></td>
              <td><input type="date" id="in_tanggalProduksi" onchange="calculateExpiredAuto()"></td>
              <td><div class="hint-awam">Isi tanggal produksi barang. Data ini dipakai untuk menghitung tanggal expired otomatis.</div></td>
            </tr>
            <tr>
              <td>5</td>
              <td><div class="field-name">Nama Barang <span class="req-pill">WAJIB</span></div><span class="field-sub">Pilih dari master barang</span></td>
              <td><select id="in_namaBarang" onchange="applyBarangDefault('in')"></select></td>
              <td><div class="hint-awam">Pilih nama barang yang diterima. Satuan, status, dan umur expired akan mengikuti master barang jika sudah disetting.</div></td>
            </tr>
            <tr>
              <td>6</td>
              <td><div class="field-name">Umur Expired</div><span class="field-sub">Dalam bulan</span></td>
              <td><input type="number" id="in_expiredBulan" oninput="calculateExpiredAuto()" placeholder="Contoh: 12"></td>
              <td><div class="hint-awam">Masukkan masa simpan barang. Contoh 12 berarti expired 12 bulan dari tanggal produksi.</div></td>
            </tr>
            <tr>
              <td>7</td>
              <td><div class="field-name">Tanggal Expired <span class="auto-pill">OTOMATIS</span></div><span class="field-sub">Hasil perhitungan sistem</span></td>
              <td><input type="date" id="in_tanggalExpired" readonly></td>
              <td><div class="hint-awam">Tanggal ini otomatis muncul setelah tanggal produksi dan umur expired diisi.</div></td>
            </tr>
            <tr>
              <td>8</td>
              <td><div class="field-name">Qty Masuk Batch Pertama <span class="req-pill">WAJIB</span></div><span class="field-sub">Jumlah barang diterima per batch</span></td>
              <td><input type="text" id="in_qty" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Contoh: 100" onkeydown="return preventQtyDecimal(event)" oninput="normalizeQtyInput(this)" onpaste="setTimeout(function(){ normalizeQtyInput(document.getElementById('in_qty')); }, 0)"></td>
              <td><div class="hint-awam">Isi qty untuk batch pertama. Jika ada batch tambahan, klik tombol Tambah Batch di bawah.</div></td>
            </tr>
            <tr>
              <td>9</td>
              <td><div class="field-name">Satuan</div><span class="field-sub">Carton / Pack / Pcs / Kg</span></td>
              <td><select id="in_satuan"><option value="Carton">Carton</option><option value="Pack">Pack</option><option value="Pcs">Pcs</option><option value="Kg">Kg</option></select></td>
              <td><div class="hint-awam">Pilih satuan barang. Biasanya otomatis mengikuti master barang.</div></td>
            </tr>
            <tr>
              <td>10</td>
              <td><div class="field-name">Status Barang</div><span class="field-sub">Release / Hold / lainnya</span></td>
              <td><select id="in_status"></select></td>
              <td><div class="hint-awam">Pilih kondisi barang saat diterima. Contoh RELEASE jika boleh dipakai, HOLD jika masih ditahan.</div></td>
            </tr>
            <tr>
              <td>11</td>
              <td><div class="field-name">Koordinator / Shift In</div><span class="field-sub">PIC barang masuk</span></td>
              <td><select id="in_shiftIn"></select></td>
              <td><div class="hint-awam">Pilih nama shift atau koordinator yang bertanggung jawab menerima barang.</div></td>
            </tr>
            <tr>
              <td>12</td>
              <td><div class="field-name">Nomor BSTB</div><span class="field-sub">Nomor dokumen</span></td>
              <td><input type="text" id="in_nomorBSTB" placeholder="Contoh: BSTB-001"></td>
              <td><div class="hint-awam">Isi nomor dokumen BSTB agar transaksi mudah dicari kembali.</div></td>
            </tr>
            <tr>
              <td>13</td>
              <td><div class="field-name">Nomor Batch Pertama</div><span class="field-sub">Kode batch / lot produksi</span></td>
              <td><input type="text" id="in_nomorBatch" placeholder="Contoh: BATCH-001"></td>
              <td><div class="hint-awam">Isi nomor batch/lot untuk qty pertama. Jika 1 BSTB berisi beberapa batch, tambahkan baris batch di bawah.</div></td>
            </tr>
            <tr>
              <td>14</td>
              <td><div class="field-name">Lokasi Rak Tujuan Batch Pertama</div><span class="field-sub">Rak penyimpanan barang</span></td>
              <td><div class="search-select-box"><input type="search" id="in_lokasiRak_search" placeholder="Cari rak tujuan / batch / tanggal keluar..." autocomplete="off" oninput="fillRackSelect('in_lokasiRak', true)" onkeydown="handleSearchSelectKey(event, 'in_lokasiRak', 'showInboundRackInfo')"><select id="in_lokasiRak" onchange="showInboundRackInfo()"></select></div><span class="search-help">Ketik kode rak, barang, nomor batch, tanggal produksi, atau tanggal keluar terakhir. Rak yang sudah berisi stock tetap bisa dipilih untuk batch/lot baru.</span><div id="in_lokasiRak_info" class="rack-lastout-info"></div></td>
              <td><div class="hint-awam">Pilih rak tujuan. Satu rak boleh menampung banyak batch/lot, selama nomor batch/lot tercatat jelas.</div></td>
            </tr>
            <tr>
              <td>15</td>
              <td><div class="field-name">Nomor IT Kirim</div><span class="field-sub">Referensi pengiriman</span></td>
              <td><input type="text" id="in_nomorITKirim" placeholder="Nomor IT Kirim jika ada"></td>
              <td><div class="hint-awam">Isi jika ada nomor IT kirim dari dokumen atau sistem pengiriman.</div></td>
            </tr>
            <tr>
              <td>16</td>
              <td><div class="field-name">Keterangan</div><span class="field-sub">Catatan tambahan</span></td>
              <td><textarea id="in_keterangan" placeholder="Contoh: kondisi barang baik / pallet rusak / dokumen menyusul"></textarea></td>
              <td><div class="hint-awam">Isi catatan tambahan bila ada informasi penting tentang barang masuk.</div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card" style="background:#f8fafc; margin-top:10px;">
        <div class="section-title"><span>🧩</span><div>Batch Tambahan dalam 1 Transaksi</div></div>
        <div class="small">Gunakan tombol ini jika 1 transaksi/BSTB berisi lebih dari 1 nomor batch. Setiap batch wajib memiliki Qty dan Lokasi Rak. Rak boleh sama untuk beberapa batch; sistem membedakan stock berdasarkan relasi Rak + Nomor Batch/Lot.</div>
        <div id="in_batch_lines" style="margin-top:8px;"></div>
        <button type="button" class="secondary" onclick="addInboundBatchLine()">➕ Tambah Batch Lain</button>
      </div>
      <div class="masuk-action-grid">
        <div class="small">Sebelum klik simpan, pastikan <b>Nama Barang</b>, <b>Nomor Batch</b>, <b>Qty</b>, <b>Nomor BSTB</b>, <b>Lokasi Rak</b>, dan <b>Waktu Masuk CS</b> sudah benar.</div>
        <button class="success" onclick="submitMasuk()">💾 Simpan Barang Masuk</button>
      </div>
      <div id="msg_masuk" class="msg"></div>
    </div>
  </div>

  <div id="keluar" class="panel"><div class="card"><div class="section-title"><span>🚚</span><div>Barang Keluar Multiple Output</div></div>
    <label>Tanggal Dimuat</label><input type="date" id="out_tglDimuat">
    <label>Kode Resto / Tujuan Resto</label>
    <div class="resto-search-box">
      <input type="search" id="out_restoSearch" placeholder="Cari kode resto, nama resto, nopol, atau sopir..." autocomplete="off" oninput="renderRestoOptions(this.value)" onkeydown="handleRestoSearchKey(event)">
      <select id="out_restoId" onchange="applyRestoDefault()"></select>
    </div>
    <div id="out_restoSelectedInfo" class="small resto-selected-info">Ketik kata kunci untuk mempercepat pencarian tujuan resto.</div>
    <div class="small">Jika kode resto double, sistem menampilkan beberapa pilihan berdasarkan nama resto, nopol, dan sopir. Search bisa memakai kode, nama resto, nopol, atau nama sopir.</div>
    <div class="grid2">
      <div><label>Nopol</label><input type="text" id="out_nopol" readonly></div>
      <div><label>WA Sopir</label><input type="text" id="out_waSopir" readonly></div>
    </div>
    <label>Nama Sopir</label><input type="text" id="out_namaSopir" readonly>
    <label>Shift Out / Koordinator</label><select id="out_shiftOut"></select>
    <label>Nomor Surat Jalan</label><input type="text" id="out_nomorSuratJalan">
    <label>Nomor IT Kirim</label><input type="text" id="out_nomorITKirim">
    <label>Keterangan Transaksi</label><textarea id="out_keterangan"></textarea>
    <div class="section-title"><span>📦</span><div>Daftar Output Barang</div></div>
    <div id="output_lines"></div>
    <button class="secondary" onclick="addOutputLine()">➕ Tambah Output Barang</button>
    <button class="warning" onclick="submitKeluarBatch()">🚚 Simpan Semua Output</button><div id="msg_keluar" class="msg"></div>
  </div></div>

  <div id="adminit" class="panel">
    <div class="card">
      <div class="section-title"><span>🧾</span><div>Admin - Input Nomor IT Terima & IT Kirim</div></div>
      <div class="masuk-help-box">
        Menu ini khusus login <b>Admin IT</b> dan <b>Supervisor</b>. Isi nomor IT dalam bentuk tabel agar jelas: <b>IT Terima</b> untuk barang/dokumen diterima, dan <b>IT Kirim</b> untuk barang/dokumen dikirim.
      </div>
      <div class="form-table-wrap">
        <table class="form-table admin-it-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal IT</th>
              <th>Jenis IT</th>
              <th>Nomor IT Terima</th>
              <th>Nomor IT Kirim</th>
              <th>Referensi Dokumen</th>
              <th>Kode Resto / Supplier</th>
              <th>Nama Barang / Keterangan Item</th>
              <th>Qty</th>
              <th>Catatan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="admin_it_rows"></tbody>
        </table>
      </div>
      <div class="grid2" style="margin-top:10px;">
        <button class="secondary" type="button" onclick="addAdminItRow()">➕ Tambah Baris IT</button>
        <button class="success" type="button" onclick="submitAdminItRows()">💾 Simpan Nomor IT</button>
      </div>
      <div id="msg_adminit" class="msg"></div>
    </div>

    <div class="card">
      <div class="section-title"><span>🔗</span><div>Relasikan Nomor IT ke Database Transaksi</div></div>
      <div class="masuk-help-box">
        Pilih jenis transaksi dan tanggal, lalu klik <b>Cari Data Transaksi</b>. Admin bisa mengisi <b>IT Terima</b> untuk barang masuk atau <b>IT Kirim</b> untuk barang keluar langsung pada tabel hasil pencarian. Saat disimpan, nomor IT akan masuk ke sheet transaksi terkait dan tercatat juga di riwayat ADMIN_IT.
      </div>
      <div class="grid2">
        <div>
          <label>Jenis Transaksi</label>
          <select id="admin_it_relasi_jenis">
            <option value="MASUK">Barang Masuk / Diterima - isi IT Terima</option>
            <option value="KELUAR">Barang Keluar / Dikirim - isi IT Kirim</option>
          </select>
        </div>
        <div>
          <label>Petunjuk</label>
          <input type="text" readonly value="Cari berdasarkan tanggal transaksi barang masuk / keluar">
        </div>
        <div><label>Dari Tanggal</label><input type="date" id="admin_it_relasi_startDate"></div>
        <div><label>Sampai Tanggal</label><input type="date" id="admin_it_relasi_endDate"></div>
      </div>
      <div class="grid2" style="margin-top:10px;">
        <button class="secondary" type="button" onclick="loadAdminItRelasi()">🔎 Cari Data Transaksi</button>
        <button class="success" type="button" onclick="saveAdminItRelasi()">💾 Simpan Relasi Nomor IT</button>
      </div>
      <div id="msg_adminit_relasi" class="msg"></div>
      <div id="admin_it_relasi_result"><div class="empty">Belum ada pencarian. Pilih tanggal lalu klik Cari Data Transaksi.</div></div>
    </div>

    <div class="card">
      <div class="section-title"><span>📋</span><div>Riwayat Input IT Admin</div></div>
      <div class="grid2">
        <div><label>Dari Tanggal</label><input type="date" id="admin_it_startDate"></div>
        <div><label>Sampai Tanggal</label><input type="date" id="admin_it_endDate"></div>
      </div>
      <button class="secondary" onclick="loadAdminItHistory()">🔎 Tampilkan Riwayat IT</button>
      <div id="admin_it_history"></div>
    </div>

    <div class="card">
      <div class="section-title"><span>🧺</span><div>Admin - Picking List Berdasarkan PO</div></div>
      <div class="masuk-help-box">
        Buat picking list barang yang akan dimuat berdasarkan <b>Nomor PO</b>. Sistem akan mengambil rekomendasi lot/batch berdasarkan FEFO dari stock onhand. Picking list ini belum memotong stock; stock baru terpotong saat menu <b>Barang Keluar</b> disimpan.
      </div>
      <div class="grid2">
        <div><label>Nomor PO</label><input type="text" id="pick_nomorPO" placeholder="Contoh: PO-001"></div>
        <div><label>Tanggal Muat</label><input type="date" id="pick_tanggalMuat"></div>
        <div>
          <label>Kode Resto / Tujuan</label>
          <div class="resto-search-box">
            <input type="search" id="pick_restoSearch" placeholder="Cari resto, nopol, sopir..." autocomplete="off" oninput="renderPickingRestoOptions(this.value)">
            <select id="pick_restoId"></select>
          </div>
        </div>
        <div><label>Nomor Surat Jalan / DO</label><input type="text" id="pick_nomorSJ" placeholder="Opsional"></div>
      </div>
      <label>Catatan Picking</label><textarea id="pick_catatan" placeholder="Catatan tambahan untuk picker/loading"></textarea>
      <div class="section-title"><span>📦</span><div>Item PO yang Akan Dipicking</div></div>
      <div class="form-table-wrap">
        <table class="form-table">
          <thead><tr><th>No</th><th>Nama Barang</th><th>Qty PO</th><th>Satuan</th><th>Aksi</th></tr></thead>
          <tbody id="pick_item_rows"></tbody>
        </table>
      </div>
      <div class="grid2" style="margin-top:10px;">
        <button class="secondary" type="button" onclick="addPickingItemRow()">➕ Tambah Item PO</button>
        <button class="success" type="button" onclick="createPickingListFromPOClient()">🧺 Buat Picking List</button>
      </div>
      <div id="msg_pick" class="msg"></div>
    </div>

    <div class="card">
      <div class="section-title"><span>📋</span><div>Riwayat Picking List PO</div></div>
      <div class="grid2">
        <div><label>Dari Tanggal Muat</label><input type="date" id="pick_hist_startDate"></div>
        <div><label>Sampai Tanggal Muat</label><input type="date" id="pick_hist_endDate"></div>
      </div>
      <label>Cari PO / SJ / Resto / Barang / Batch</label><input type="search" id="pick_hist_keyword" placeholder="Contoh: PO-001 / kode resto / nama barang / batch">
      <div class="grid2" style="margin-top:10px;">
        <button class="secondary" type="button" onclick="loadPickingListHistory()">🔎 Tampilkan Picking List</button>
        <button class="secondary" type="button" onclick="clearPickingListHistoryFilter()">📋 Tampilkan Semua</button>
        <button class="warning" type="button" onclick="printPickingListClient()">🖨️ Cetak Picking List</button>
        <button class="success" type="button" onclick="createBarangKeluarFromPickingListClient()">🚚 Buat Barang Keluar dari Picking</button>
      </div>
      <div id="msg_pick_history" class="msg"></div>
      <div id="pick_history"></div>
    </div>

    <div class="card">
      <div class="section-title"><span>✏️</span><div>Edit Barang Keluar Jika Ada Ketidaksesuaian</div></div>
      <div class="masuk-help-box">
        Gunakan menu ini hanya jika setelah barang keluar ditemukan qty tidak sesuai. Sistem akan mengubah qty di <b>BARANG_KELUAR</b>, mengoreksi <b>STOCK_ONHAND</b>, menyesuaikan total <b>OTDR</b>, dan membuat log audit.
      </div>
      <div class="grid2">
        <div><label>Dari Tanggal Dimuat</label><input type="date" id="edit_out_startDate"></div>
        <div><label>Sampai Tanggal Dimuat</label><input type="date" id="edit_out_endDate"></div>
      </div>
      <label>Cari SJ / Resto / Barang / ID Stock / Batch / OTDR</label><input type="search" id="edit_out_keyword" placeholder="Ketik nomor surat jalan, item, batch, rak, atau ID OTDR">
      <button class="secondary" type="button" onclick="loadBarangKeluarEditList()">🔎 Cari Barang Keluar</button>
      <div id="edit_out_result"><div class="empty">Belum ada pencarian. Pilih tanggal atau kata kunci lalu klik Cari Barang Keluar.</div></div>
      <div id="msg_edit_out" class="msg"></div>
    </div>
  </div>

  <div id="otdr" class="panel"><div class="card"><div class="section-title"><span>⏱️</span><div>Update OTDR Loading</div></div>
    <label>Pilih OTDR dari Barang Keluar</label><select id="otdr_id" onchange="loadSelectedOtdr()"></select>
    <div id="otdr_info" class="small"></div>
    <div class="grid2"><div><label>Nopol</label><input type="text" id="otdr_nopol"></div><div><label>WA Sopir</label><input type="text" id="otdr_waSopir"></div></div>
    <label>Nama Sopir</label><input type="text" id="otdr_namaSopir">
    <label>Start Muat</label><input type="datetime-local" id="otdr_startMuat">
    <label>Selesai Muat</label><input type="datetime-local" id="otdr_selesaiMuat">
    <label>Nama-nama Yang Muat</label><textarea id="otdr_namaMuat" placeholder="Contoh: Budi, Andi, Sari"></textarea>
    <label>Catatan</label><textarea id="otdr_catatan"></textarea>
    <div class="small">Setelah barang keluar dibuat, gunakan tombol <b>WA Sopir</b> pada tabel di bawah untuk mengirim link dashboard bukti terima. Jika sopir/checker submit status <b>SESUAI</b>, status OTDR otomatis menjadi <b>COMPLETE</b> dan link bukti tersimpan di kolom OTDR.</div>
    <button class="success" onclick="submitOtdr()">✅ Simpan OTDR</button><button class="secondary" onclick="loadOtdrOptions()">🔄 Refresh OTDR</button><div id="msg_otdr" class="msg"></div>
    <div id="otdr_table"></div>
  </div></div>

  <div id="lokasi" class="panel"><div class="card"><div class="section-title"><span>🧭</span><div>Update Lokasi / Status Barang</div></div>
    <label>Cari ID Stock / Rak / Tanggal Produksi</label>
    <div class="search-select-box">
      <input type="search" id="loc_stockSearch" placeholder="Cari ID stock, nama barang, batch, rak, tanggal produksi, expired, BSTB..." autocomplete="off" oninput="refreshLocationStockOptions()" onkeydown="handleSearchSelectKey(event, 'loc_idStock', applySelectedStockToLokasi)">
      <select id="loc_idStock" onchange="applySelectedStockToLokasi()"></select>
    </div>
    <div id="loc_info" class="small"></div>
    <label>Lokasi Baru (Opsional)</label>
    <div class="search-select-box">
      <input type="search" id="loc_lokasiBaru_search" placeholder="Cari rak tujuan baru..." autocomplete="off" oninput="fillRackSelect('loc_lokasiBaru', false)" onkeydown="handleSearchSelectKey(event, 'loc_lokasiBaru')">
      <select id="loc_lokasiBaru"></select>
    </div>
    <div class="small">Kosongkan jika hanya ingin update status tanpa pindah rak. Ketik kode rak untuk mempercepat pencarian lokasi.</div>
    <label>Status Baru (Opsional)</label><select id="loc_statusBaru"></select>
    <div class="small">User Inventory hanya bisa update status GOOD atau HOLD. Supervisor bisa update semua status.</div>
    <label>PIC / Koordinator</label><select id="loc_pic"></select>
    <label>Keterangan</label><textarea id="loc_keterangan" placeholder="Contoh: pindah rak / update status GOOD / update status HOLD"></textarea>
    <button onclick="submitLokasi()">🧭 Update Lokasi / Status</button><div id="msg_lokasi" class="msg"></div>
  </div></div>

  <div id="stock" class="panel"><div class="card"><div class="section-title"><span>📦</span><div>Stock Onhand / Lot-Batch</div></div><button class="secondary" onclick="loadMasterData()">🔄 Refresh</button><div id="stock_table"></div></div></div>

  <div id="fifoqc" class="panel">
    <div class="card">
      <div class="section-title"><span>✅</span><div>Quality Control - Monitoring FEFO / FIFO</div></div>
      <div class="small">Menu ini khusus QC dan Supervisor untuk memonitor lot FEFO/FIFO berdasarkan tanggal expired/produksi. Dari menu ini QC bisa update status lot khusus <b>HOLD ↔ RELEASE</b> tanpa pindah lokasi rak. Tabel default menampilkan <b>semua lot aktif</b> agar tombol update status langsung terlihat.</div>
      <div class="summary-grid">
        <div class="summary-card"><b id="fifo_total_lot">0</b><span>Total lot aktif</span></div>
        <div class="summary-card"><b id="fifo_priority_lot">0</b><span>Prioritas keluar ≤ 30 hari</span></div>
        <div class="summary-card"><b id="fifo_expired_lot">0</b><span>Expired</span></div>
        <div class="summary-card"><b id="fifo_hold_lot">0</b><span>Hold / tidak release</span></div>
      </div>
      <div class="grid2" style="margin-top:10px;">
        <div><label>Nama Barang</label><select id="fifo_namaBarang" onchange="renderFifoQcMonitoring()"></select></div>
        <div><label>Status</label><select id="fifo_status" onchange="renderFifoQcMonitoring()"></select></div>
      </div>
      <div class="grid2">
        <div><label>Batas Monitoring FEFO</label><select id="fifo_maxDays" onchange="renderFifoQcMonitoring()"><option value="0" selected>Semua lot aktif</option><option value="7">Prioritas ≤ 7 hari</option><option value="14">Prioritas ≤ 14 hari</option><option value="30">Prioritas ≤ 30 hari</option><option value="60">Prioritas ≤ 60 hari</option><option value="90">Prioritas ≤ 90 hari</option></select></div>
        <div><label>Pencarian Cepat</label><input type="search" id="fifo_search" placeholder="Cari ID stock, barang, rak, tanggal produksi, status, BSTB..." oninput="renderFifoQcMonitoring()"></div>
      </div>
      <div class="grid2">
        <button onclick="renderFifoQcMonitoring()">🔎 Tampilkan Monitoring FEFO</button>
        <button class="secondary" onclick="loadQcFifoMonitoring(true)">🔄 Refresh Monitoring QC</button>
      </div>
      <div id="msg_fifoqc" class="msg"></div>
      <div id="fifoqc_table"></div>
    </div>
  </div>


  <div id="importstock" class="panel">
    <div class="card">
      <div class="section-title"><span>⬆️</span><div>Supervisor - Import Stock Awal / Stock Massal</div></div>
      <div class="small">
        Fitur ini membaca data dari sheet <b>STOCK_IMPORT_TEMPLATE</b>. Data akan divalidasi dulu terhadap <b>DATABASE_BARANG</b>, <b>DATABASE_STATUS</b>, dan <b>DATABASE_RAK</b> supaya relasi antar sheet aman dan tidak membuat bug pada stock maupun login.
      </div>
      <div class="grid2">
        <button type="button" class="secondary" onclick="createStockImportTemplate()">📄 Buat / Perbarui Template</button>
        <button type="button" onclick="validateStockImportTemplate()">✅ Validasi Data Template</button>
      </div>
      <div class="grid2">
        <div>
          <label>Upload CSV ke Template</label>
          <input type="file" id="stock_import_csv" accept=".csv,text/csv" onchange="stockImportCsvNeedsUpload=true; showMsg('stock_import_msg','File CSV sudah dipilih. Klik Validasi Data Template atau Upload CSV ke Sheet Template.',true);">
          <div class="small">CSV boleh memakai header template, boleh delimiter koma/titik koma. Jika langsung klik Validasi, sistem akan upload CSV ke sheet template terlebih dahulu.</div>
        </div>
        <div>
          <label>Aksi Import</label>
          <button type="button" class="success" onclick="importStockFromTemplate()">⬆️ Import Stock yang Sudah Valid</button>
        </div>
      </div>
      <button type="button" class="warning" onclick="uploadStockImportCsv()">📤 Upload CSV ke Sheet Template</button>
      <div id="stock_import_msg" class="msg"></div>
    </div>

    <div class="card">
      <div class="section-title"><span>📋</span><div>Format Kolom Template</div></div>
      <table>
        <thead><tr><th>Kolom</th><th>Keterangan</th></tr></thead>
        <tbody>
          <tr><td>Aksi</td><td>Isi <b>IMPORT</b> atau kosong untuk diproses. Isi <b>SKIP</b> untuk dilewati.</td></tr>
          <tr><td>Tanggal BSTB</td><td>Boleh kosong, sistem isi tanggal hari ini. Disarankan tetap diisi untuk histori.</td></tr>
          <tr><td>Tanggal Produksi</td><td>Wajib. Format tanggal spreadsheet, contoh 2026-05-18.</td></tr>
          <tr><td>Tanggal Expired</td><td>Opsional. Kalau kosong, otomatis dihitung dari Umur Expired di DATABASE_BARANG.</td></tr>
          <tr><td>Nama Barang</td><td>Wajib sama dengan DATABASE_BARANG.</td></tr>
          <tr><td>Qty Stock Awal</td><td>Wajib angka bulat, tanpa koma/desimal.</td></tr>
          <tr><td>Satuan / Status / Lokasi Rak</td><td>Bisa kosong jika default sudah ada di DATABASE_BARANG. Tetap divalidasi ke database terkait.</td></tr>
          <tr><td>Nomor BSTB</td><td>Boleh kosong, sistem isi otomatis STOCK-AWAL-tanggal.</td></tr>
        </tbody>
      </table>
      <div class="small">Catatan rak: 1 rak dapat berisi lebih dari 1 batch/lot. Kapasitas occupancy tetap dihitung dari rak <b>DEDICATED</b>; rak <b>FLOOR/GANGWAY</b> tidak dihitung kapasitas.</div>
    </div>

    <div class="card">
      <div class="section-title"><span>🔎</span><div>Hasil Validasi / Import</div></div>
      <div id="stock_import_result"><div class="empty">Belum ada hasil. Klik Buat Template, Upload CSV, atau Validasi Data Template.</div></div>
    </div>
  </div>

  <div id="occupancy" class="panel">
    <div class="card">
      <div class="section-title"><span>📈</span><div>Occupancy Gudang / Okupansi Rak</div></div>
      <div class="small">Grafik menghitung persentase Qty RELEASE, HOLD, dan TOTAL terhadap total kapasitas rak DEDICATED saja. Rak FLOOR/GANGWAY/T tetap bisa dipakai transaksi, tetapi tidak dihitung sebagai kapasitas occupancy.</div>
      <div class="occ-filter">
        <div><label>Dari Tanggal</label><input type="date" id="occ_startDate"></div>
        <div><label>Sampai Tanggal</label><input type="date" id="occ_endDate"></div>
        <div><label>Basis Kapasitas</label><input type="text" value="Rak DEDICATED saja" readonly></div>
      </div>
      <div class="occ-actions">
        <button onclick="loadOccupancyReport()">📈 Tampilkan Grafik Okupansi</button>
        <button class="secondary" onclick="loadMasterData(); loadOccupancyReport();">🔄 Refresh Data</button>
      </div>
      <div id="msg_occupancy" class="msg"></div>
      <div class="occ-summary">
        <div class="occ-card"><div class="metric-title">Kapasitas Rak</div><div class="metric" id="occ_capacity_total">0</div><div class="small" id="occ_capacity_rack">0 rak</div></div>
        <div class="occ-card"><div class="metric-title">% RELEASE</div><div class="metric" id="occ_release_pct">0%</div><div class="small" id="occ_release_qty">0 qty</div></div>
        <div class="occ-card"><div class="metric-title">% HOLD</div><div class="metric" id="occ_hold_pct">0%</div><div class="small" id="occ_hold_qty">0 qty</div></div>
        <div class="occ-card"><div class="metric-title">% TOTAL</div><div class="metric" id="occ_total_pct">0%</div><div class="small" id="occ_total_qty">0 qty</div></div>
      </div>
      <div class="occ-chart-wrap">
        <canvas id="occ_chart_canvas" height="280"></canvas>
        <div class="occ-legend">
          <span><i class="occ-dot occ-release"></i>% Okupansi RELEASE</span>
          <span><i class="occ-dot occ-hold"></i>% Okupansi HOLD</span>
          <span><i class="occ-dot occ-total"></i>% Okupansi TOTAL</span>
        </div>
      </div>
      <div id="occupancy_table"></div>
    </div>

    <div class="card" id="occ_capacity_card">
      <div class="section-title"><span>🧮</span><div>Supervisor - Isi Kapasitas Rak</div></div>
      <div class="small">Isi kapasitas dan jenis rak. Kode R/RAK = DEDICATED, kode GANGWAY dan T = FLOOR. Grafik occupancy hanya memakai kapasitas rak DEDICATED.</div>
      <div id="rack_capacity_editor"></div>
      <button class="success" onclick="saveRackCapacities()">💾 Simpan Kapasitas Rak</button>
    </div>
  </div>

  <div id="stockopname" class="panel"><div class="card no-print"><div class="section-title"><span>📝</span><div>Cetak Form Stock Opname</div></div>
    <div class="small">Menu ini tersedia untuk akun Inventory dan Supervisor. Isi Qty Actual setelah hitung fisik, lalu status akan otomatis menjadi Sesuai / Tidak Sesuai.</div>
    <div class="stockopname-filter">
      <div><label>Nama Barang</label><select id="op_namaBarang"></select></div>
      <div><label>Status</label><select id="op_status"></select></div>
      <div><label>Lokasi Rak</label><div class="search-select-box"><input type="search" id="op_lokasiRak_search" placeholder="Cari rak / tanggal produksi..." autocomplete="off" oninput="renderStockOpnameRackOptions()" onkeydown="handleSearchSelectKey(event, 'op_lokasiRak')"><select id="op_lokasiRak"></select></div></div>
    </div>
    <div class="stockopname-actions">
      <button onclick="loadStockOpnameForm()">🔎 Buat Form</button>
      <button class="success" onclick="printStockOpnameForm()">🖨️ Cetak Form</button>
    </div>
    <div id="msg_stockopname" class="msg"></div>
  </div>
  <div id="stockopname_print_area"></div>
  </div>

  <div id="mutasi" class="panel"><div class="card"><div class="section-title"><span>📜</span><div>Mutasi Barang</div></div>
    <label>Dari Tanggal</label><input type="date" id="mut_startDate"><label>Sampai Tanggal</label><input type="date" id="mut_endDate"><label>Jenis Mutasi</label><select id="mut_jenisMutasi"><option value="">Semua</option><option value="IN">IN</option><option value="OUT">OUT</option><option value="PINDAH_LOKASI">PINDAH LOKASI</option><option value="UPDATE_STATUS">UPDATE STATUS</option></select><label>Nama Barang</label><select id="mut_namaBarang"></select><label>Status</label><select id="mut_status"></select><button onclick="loadMutasiReport()">🔎 Tampilkan</button><button class="success" onclick="exportMutasiCsv()">⬇️ Export CSV</button><div id="msg_mutasi" class="msg"></div><div id="mutasi_table"></div>
  </div></div>

  <div id="timemotion" class="panel"><div class="card"><div class="section-title"><span>⏱️</span><div>Supervisor - Time Motion Study</div></div>
    <div class="small">Mengukur Time Motion barang masuk dari input Waktu Masuk CS format menit:detik. Jika belum diisi, sistem memakai interval Jam In antar transaksi pada tanggal yang sama. Barang keluar tetap dari Start/Selesai Muat pada OTDR.</div>
    <div class="grid2"><div><label>Dari Tanggal</label><input type="date" id="tm_startDate"></div><div><label>Sampai Tanggal</label><input type="date" id="tm_endDate"></div></div>
    <label>Jenis Proses</label><select id="tm_tipe"><option value="">Semua</option><option value="IN">Barang Masuk</option><option value="OUT">Barang Keluar</option></select>
    <button onclick="loadTimeMotionReport()">⏱️ Tampilkan Time Motion</button>
    <div id="msg_timemotion" class="msg"></div>
    <div class="grid2" style="margin-top:10px;">
      <div class="card"><div class="metric-title">Rata-rata IN</div><div class="metric" id="tm_avg_in">0</div><div class="small">menit / masuk CS</div></div>
      <div class="card"><div class="metric-title">Rata-rata OUT</div><div class="metric" id="tm_avg_out">0</div><div class="small">menit / OTDR</div></div>
      <div class="card"><div class="metric-title">Total Terukur</div><div class="metric" id="tm_total_measured">0</div><div class="small">IN + OUT</div></div>
      <div class="card"><div class="metric-title">Tanpa Pembanding</div><div class="metric" id="tm_pending">0</div><div class="small">awal data / belum lengkap</div></div>
    </div>
    <div id="timemotion_table"></div>
  </div></div>


  <div id="rackqr" class="panel"><div class="card"><div class="section-title"><span>📷</span><div>Scan QR / Barcode Nomor Rak</div></div>
    <div class="small">Menu ini dapat digunakan Supervisor serta Koordinator IN/OUT untuk scan QR/barcode yang berisi nomor rak. Setelah discan, sistem menampilkan nama item, jumlah item, tanggal produksi, tanggal expired, dan last update stock.</div>
    <div class="qr-scan-box">
      <div class="camera-help" id="camera_help">
        Jika kamera live tetap muncul <b>NotAllowedError</b> walaupun sudah Allow, biasanya disebabkan pembatasan iframe Google Apps Script/Google Sheets.
        Gunakan mode <b>Ambil Foto QR/Barcode</b> di bawah karena mode ini lebih stabil untuk HP dan laptop.
      </div>

      <div class="qr-mode-box">
        <div class="qr-mode-title">Mode 1 - Ambil Foto QR/Barcode dari Kamera / Galeri</div>
        <input type="file" id="qr_capture_input" accept="image/*" capture="environment" onchange="scanRackQrFromFile(this)">
        <div class="small">Rekomendasi utama. Di HP akan membuka kamera; di laptop bisa membuka kamera/file picker sesuai browser.</div>
      </div>

      <div class="qr-mode-box">
        <div class="qr-mode-title">Mode 2 - Kamera Live Scanner</div>
        <div id="qr_reader"></div>
        <div class="grid2" style="margin-top:10px;">
          <button class="success" onclick="startRackQrScanner()">📷 Mulai Kamera Live</button>
          <button class="secondary" onclick="stopRackQrScanner()">⏹️ Stop Kamera</button>
        </div>
        <div class="small">Jika mode live ditolak browser, gunakan Mode 1 Ambil Foto QR.</div>
      </div>

      <div class="qr-mode-box">
        <div class="qr-mode-title">Mode 3 - Upload Gambar QR/Barcode</div>
        <input type="file" id="qr_file_input" accept="image/*" onchange="scanRackQrFromFile(this)">
        <div class="small">Fallback jika kamera live tidak bisa.</div>
      </div>

      <div class="small">Jika semua mode kamera/gambar tidak bisa digunakan, masukkan nomor rak manual di bawah.</div>
    </div>

    <label>Nomor Rak / Hasil QR</label>
    <input type="text" id="qr_rak_text" placeholder="Contoh: RAK-A1, RAK:RAK-A1, atau barcode rak">
    <button onclick="loadRackQrStockByText()">🔎 Cek Stock Rak</button>
    <div id="msg_rackqr" class="msg"></div>
    <div id="qr_rack_result"></div>
  </div></div>

  <div id="report" class="panel">
    <div class="card">
      <div class="section-title"><span>📑</span><div>Report Stock</div></div>
      <label>Nama Barang</label><select id="rep_namaBarang"></select>
      <label>Status</label><select id="rep_status"></select>
      <label>Group By</label><select id="rep_groupBy"><option value="namaStatus">Nama Barang + Status</option><option value="namaBarang">Nama Barang</option><option value="status">Status</option><option value="lokasiRak">Lokasi Rak</option></select>
      <button onclick="loadStockReport()">📊 Tampilkan Report</button>
      <div id="report_group_table"></div>
      <div id="report_detail_table"></div>
    </div>

    <div class="card">
      <div class="section-title"><span>📥📤</span><div>Report Inbound / Outbound Per Hari & Per Item</div></div>
      <div class="small">Menampilkan total qty inbound dan outbound berdasarkan range tanggal seperti contoh tabel, plus ringkasan per hari dari sheet BARANG_MASUK dan BARANG_KELUAR.</div>
      <div class="grid2">
        <div><label>Dari Tanggal</label><input type="date" id="rep_io_startDate"></div>
        <div><label>Sampai Tanggal</label><input type="date" id="rep_io_endDate"></div>
      </div>
      <label>Nama Barang</label><select id="rep_io_namaBarang"></select>
      <button onclick="loadInboundOutboundReport()">🔎 Tampilkan Inbound / Outbound</button>
      <div id="report_inout_summary"></div>
      <div id="report_inout_range_table"></div>
      <div id="report_inout_daily"></div>
      <div id="report_inout_table"></div>
    </div>
  </div>
  </div>

<script>
  var master = { barang: [], status: [], koordinator: [], rak: [], rakLastOut: [], rakKapasitas: [], stock: [], lotRakBatch: [], resto: [], otdr: [], syncWarning: '' };
  var masterLoaded = false;
  var fifoQcRows = [];
  var fifoQcLastLoadedAt = '';
  var dashboardSummaryLoading = false;
  var outputLineCounter = 0;
  var inboundBatchCounter = 0;
  var currentUser = null;
  var authToken = '';
  var stockOpnameCurrent = null;

  window.addEventListener('error', function(ev) {
    try {
      var el = document.getElementById('msg_login');
      if (el && !document.body.classList.contains('logged-in')) {
        el.style.display = 'block';
        el.className = 'msg err';
        el.textContent = 'Frontend error: ' + (ev && ev.message ? ev.message : 'script error') + '. Deploy ulang versi script terbaru, lalu refresh halaman.';
      }
    } catch (e) {}
  });

  document.addEventListener('DOMContentLoaded', function() { initLogin(); });


  function initLogin() {
    setupLoginUx_();
    var savedToken = localStorage.getItem('inventoryAuthToken') || sessionStorage.getItem('inventoryAuthToken') || '';
    if (!savedToken) {
      document.body.classList.remove('logged-in');
      return;
    }

    google.script.run.withSuccessHandler(function(res) {
      if (res && res.ok) {
        authToken = savedToken;
        currentUser = res.user;
        startAppAfterLogin();
      } else {
        localStorage.removeItem('inventoryAuthToken');
        sessionStorage.removeItem('inventoryAuthToken');
        document.body.classList.remove('logged-in');
      }
    }).withFailureHandler(function() {
      localStorage.removeItem('inventoryAuthToken');
      sessionStorage.removeItem('inventoryAuthToken');
      document.body.classList.remove('logged-in');
      showMsg('msg_login', 'Sesi lama dibersihkan. Silakan login ulang agar dashboard terbuka dengan relasi terbaru.', false);
    }).restoreLogin({ token: savedToken });
  }

  function doLogin() {
    if (doLogin._busy) return;
    var username = val('login_username');
    var password = val('login_password');
    if (!username || !password) {
      showMsg('msg_login', 'Username dan password wajib diisi.', false);
      return;
    }
    if (!(window.google && google.script && google.script.run)) {
      showMsg('msg_login', 'Backend google.script.run belum tersedia. Buka melalui URL Web App /exec dan deploy ulang versi terbaru.', false);
      return;
    }
    doLogin._busy = true;
    setLoginBusy_(true);
    showMsg('msg_login', 'Memeriksa login dan menyiapkan DATABASE_USER...', true);
    var loginTimeout = setTimeout(function() {
      if (doLogin._busy) {
        showMsg('msg_login', 'Backend masih belum merespons. Cek Executions Apps Script, jalankan repairLoginAndBackendRouting(), lalu deploy ulang versi terbaru.', false);
      }
    }, 30000);

    google.script.run.withSuccessHandler(function(res) {
      clearTimeout(loginTimeout);
      doLogin._busy = false;
      setLoginBusy_(false);
      if (!res || !res.ok || !res.token || !res.user) {
        showMsg('msg_login', 'Login gagal: respons server kosong/tidak valid. Jalankan setupInventorySystem() lalu coba lagi.', false);
        return;
      }
      authToken = res.token;
      currentUser = res.user;
      var remember = document.getElementById('remember_login') ? document.getElementById('remember_login').checked : true;
      if (remember) {
        localStorage.setItem('inventoryAuthToken', authToken);
        sessionStorage.removeItem('inventoryAuthToken');
      } else {
        sessionStorage.setItem('inventoryAuthToken', authToken);
        localStorage.removeItem('inventoryAuthToken');
      }
      showMsg('msg_login', res.setupWarning ? ('Login berhasil, tetapi ada warning setup: ' + res.setupWarning) : 'Login berhasil.', true);
      startAppAfterLogin();
    }).withFailureHandler(function(err) {
      clearTimeout(loginTimeout);
      doLogin._busy = false;
      setLoginBusy_(false);
      showMsg('msg_login', err && err.message ? err.message : err, false);
    }).loginUser({ username: username, password: password });
  }

  function doLogout() {
    var token = authToken;
    authToken = '';
    currentUser = null;
    localStorage.removeItem('inventoryAuthToken');
    sessionStorage.removeItem('inventoryAuthToken');
    document.body.classList.remove('logged-in');
    if (token) google.script.run.logoutUser({ token: token });
  }


  function setupLoginUx_() {
    var username = document.getElementById('login_username');
    var password = document.getElementById('login_password');
    var loginBtn = document.getElementById('login_btn');
    if (loginBtn) {
      loginBtn.onclick = function(ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        doLogin();
      };
    }
    [username, password].forEach(function(el) {
      if (!el) return;
      el.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') doLogin();
      });
    });
    if (username) username.focus();
  }

  function togglePassword() {
    var input = document.getElementById('login_password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  function setLoginBusy_(busy) {
    var btn = document.getElementById('login_btn');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? 'Checking...' : 'Sign In';
  }

  function normalizeCurrentUserClient_() {
    if (!currentUser) return;
    currentUser.access = currentUser.access || {};
    ['masuk','keluar','otdr','lokasi','stockOpname','occupancy','fifoQc','mutasi','rackQr','scanBarcode','adminIt','supervisor'].forEach(function(key) {
      currentUser.access[key] = !!currentUser.access[key];
    });
  }

  function startAppAfterLogin() {
    normalizeCurrentUserClient_();
    document.body.classList.add('logged-in');
    updateCurrentUserLabel();
    setTodayDefaults();
    applyUserPermissions();
    renderDashboardLoading_();
    loadMasterData();
  }

  function getAuthPayload() {
    return { token: authToken };
  }

  function updateCurrentUserLabel() {
    if (!currentUser) return;
    var role = currentUser.role || '';
    text('current_user_label', 'Login: ' + currentUser.namaUser + ' | Role: ' + role);
  }

  function canAccess(tabId) {
    if (!currentUser || !currentUser.access) return false;
    if (currentUser.access.supervisor) return true;
    var adminOnly = currentUser.access.adminIt && !currentUser.access.masuk && !currentUser.access.keluar && !currentUser.access.otdr && !currentUser.access.lokasi;
    if (adminOnly) return tabId === 'dashboard' || tabId === 'stock' || tabId === 'adminit';
    if (tabId === 'dashboard' || tabId === 'stock') return true;
    if (tabId === 'fifoqc') return !!currentUser.access.fifoQc || !!currentUser.access.supervisor;
    if (tabId === 'occupancy') return !!currentUser.access.occupancy || !!currentUser.access.stockOpname;
    if (tabId === 'stockopname') return !!currentUser.access.stockOpname;
    if (tabId === 'masuk') return !!currentUser.access.masuk;
    if (tabId === 'keluar') return !!currentUser.access.keluar;
    if (tabId === 'otdr') return !!currentUser.access.otdr || !!currentUser.access.keluar;
    if (tabId === 'lokasi') return !!currentUser.access.lokasi;
    if (tabId === 'adminit') return !!currentUser.access.adminIt;
    if (tabId === 'mutasi') return !!currentUser.access.mutasi || !!currentUser.access.supervisor;
    if (tabId === 'rackqr') return !!currentUser.access.rackQr || !!currentUser.access.scanBarcode || !!currentUser.access.supervisor;
    if (tabId === 'report' || tabId === 'timemotion' || tabId === 'importstock') return !!currentUser.access.supervisor;
    return false;
  }

  function applyUserPermissions() {
    if (!currentUser) return;

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(tab) {
      var onclick = tab.getAttribute('onclick') || '';
      var match = onclick.match(/openTab\\('([^']+)'/);
      if (!match) return;
      tab.style.display = canAccess(match[1]) ? 'flex' : 'none';
    });

    lockCoordinatorSelect('in_shiftIn', 'masuk');
    lockCoordinatorSelect('out_shiftOut', 'keluar');
    lockCoordinatorSelect('loc_pic', 'lokasi');

    var activePanel = document.querySelector('.panel.active');
    var occCapacityCard = byId('occ_capacity_card');
    if (occCapacityCard) occCapacityCard.style.display = (currentUser.access && currentUser.access.supervisor) ? 'block' : 'none';

    if (activePanel && !canAccess(activePanel.id)) {
      openFirstAllowedTab();
    }
  }

  function openFirstAllowedTab() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    var first = tabs.find(function(tab) {
      var onclick = tab.getAttribute('onclick') || '';
      var match = onclick.match(/openTab\\('([^']+)'/);
      return match && canAccess(match[1]);
    });
    if (first) {
      var match = (first.getAttribute('onclick') || '').match(/openTab\\('([^']+)'/);
      if (match) openTab(match[1], first);
    }
  }

  function lockCoordinatorSelect(selectId, accessKey) {
    var select = byId(selectId);
    if (!select || !currentUser) return;

    if (!currentUser.access.supervisor && currentUser.access[accessKey]) {
      ensureSelectOption(select, currentUser.namaUser);
      select.value = currentUser.namaUser;
      select.disabled = true;
    } else {
      select.disabled = false;
    }
  }

  function ensureSelectOption(select, value) {
    var exists = Array.prototype.some.call(select.options, function(opt) { return opt.value === value; });
    if (!exists && value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
  }


  var jamInServerBaseMs = null;
  var jamInClientBaseMs = null;
  var jamInTimer = null;

  function startJamInRealtime() {
    google.script.run
      .withSuccessHandler(function(now) {
        var serverDate = now && now.iso ? new Date(now.iso) : new Date();
        jamInServerBaseMs = serverDate.getTime();
        jamInClientBaseMs = Date.now();
        updateJamInDisplay();

        if (jamInTimer) clearInterval(jamInTimer);
        jamInTimer = setInterval(updateJamInDisplay, 1000);
      })
      .withFailureHandler(function() {
        jamInServerBaseMs = Date.now();
        jamInClientBaseMs = Date.now();
        updateJamInDisplay();

        if (jamInTimer) clearInterval(jamInTimer);
        jamInTimer = setInterval(updateJamInDisplay, 1000);
      })
      .getServerNowJakarta();
  }

  function updateJamInDisplay() {
    var el = byId('in_jamIn');
    if (!el) return;

    var baseServer = jamInServerBaseMs || Date.now();
    var baseClient = jamInClientBaseMs || Date.now();
    var currentMs = baseServer + (Date.now() - baseClient);
    var currentDate = new Date(currentMs);

    el.value = formatJakartaTimeForInput(currentDate);
  }

  function formatJakartaTimeForInput(dateObj) {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(dateObj).replace(/\./g, ':');
    } catch (err) {
      return String(dateObj.toLocaleString('id-ID'));
    }
  }

  function setTodayDefaults() {
    var today = new Date().toISOString().slice(0, 10);
    byId('in_tanggalBSTB').value = today;
    byId('out_tglDimuat').value = today;
    if (byId('dash_stock_date')) byId('dash_stock_date').value = today;
    if (byId('occ_endDate')) byId('occ_endDate').value = today;
    if (byId('admin_it_startDate')) byId('admin_it_startDate').value = today;
    if (byId('admin_it_endDate')) byId('admin_it_endDate').value = today;
    if (byId('admin_it_relasi_startDate')) byId('admin_it_relasi_startDate').value = today;
    if (byId('admin_it_relasi_endDate')) byId('admin_it_relasi_endDate').value = today;
    if (byId('pick_tanggalMuat')) byId('pick_tanggalMuat').value = today;
    // Riwayat Picking List sengaja dikosongkan agar tombol Tampilkan Picking List
    // langsung menampilkan seluruh data terbaru, bukan hanya tanggal hari ini.
    if (byId('pick_hist_startDate')) byId('pick_hist_startDate').value = '';
    if (byId('pick_hist_endDate')) byId('pick_hist_endDate').value = '';
    if (byId('edit_out_startDate')) byId('edit_out_startDate').value = today;
    if (byId('edit_out_endDate')) byId('edit_out_endDate').value = today;
    if (byId('occ_startDate')) {
      var start = new Date();
      start.setDate(start.getDate() - 13);
      byId('occ_startDate').value = dateInputFromDate(start);
    }
    updateJamInLive();
  }

  function startJamInClock() {
    updateJamInLive();
    setInterval(updateJamInLive, 1000);
  }

  function updateJamInLive() {
    var el = byId('in_jamIn');
    if (!el) return;
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    el.value = hh + ':' + mm + ':' + ss;
  }

  function openTab(id, el) {
    if (!canAccess(id)) {
      alert('User Anda tidak memiliki akses ke menu ini.');
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll('.panel'), function(p) { p.classList.remove('active'); });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(t) { t.classList.remove('active'); });
    byId(id).classList.add('active');
    el.classList.add('active');
    if (id === 'dashboard') renderDashboard();
    if (id === 'stock') renderStockTable();
    if (id === 'fifoqc') loadQcFifoMonitoring(false);
    if (id === 'occupancy') loadOccupancyReport();
    if (id === 'stockopname' && byId('stockopname_print_area') && !byId('stockopname_print_area').innerHTML.trim()) loadStockOpnameForm();
    if (id === 'mutasi') loadMutasiReport();
    if (id === 'report') { loadStockReport(); loadInboundOutboundReport(); }
    if (id === 'timemotion') loadTimeMotionReport();
    if (id === 'otdr') loadOtdrOptions();
    if (id === 'adminit') { ensureAdminItRows(); ensurePickingItemRows(); renderPickingRestoOptions(''); loadAdminItHistory(); loadPickingListHistory(); }
    if (id === 'importstock') loadStockImportTemplateInfo();
  }

  function loadMasterData() {
    if (!currentUser) return;
    renderDashboardLoading_();

    function applyFrontendDatabase(data, sourceLabel) {
      masterLoaded = true;
      master = normalizeMasterDataClient_(data || {});

      // Dashboard dan tabel stock HARUS tetap dirender walaupun ada salah satu dropdown/element yang error.
      renderDashboardFromStock_(master.stock || [], master.otdr || []);
      renderStockTable();
      refreshLocationStockOptions();
      refreshAllOutputLineSelects();

      try {
        populateAllSelects();
      } catch (uiErr) {
        if (byId('dash_exp_table')) {
          var currentHtml = byId('dash_exp_table').innerHTML || '';
          byId('dash_exp_table').innerHTML = '<div class="msg warn">Database stock sudah terbaca, tetapi ada komponen dropdown yang belum lengkap: ' + escapeHtml(uiErr.message || uiErr) + '</div>' + currentHtml;
        }
      }

      renderDashboardFromStock_(master.stock || [], master.otdr || []);
      renderStockTable();
      fifoQcRows = normalizeStockListClient_(master.stock || []);
      refreshFifoQcFilterOptions_(fifoQcRows);
      if (byId('fifoqc') && byId('fifoqc').classList.contains('active')) renderFifoQcMonitoring();
      loadOtdrOptions();
      if (!document.querySelector('.output-line')) addOutputLine();
      ensureAdminItRows();
      ensurePickingItemRows();
      renderPickingRestoOptions('');
      applyUserPermissions();
      openFirstAllowedTab();
      showMasterSyncWarning_();

      if ((!master.stock || !master.stock.length) && byId('dash_exp_table')) {
        byId('dash_exp_table').innerHTML = '<div class="empty">Koneksi frontend berhasil, tetapi tidak ada baris aktif dari sheet STOCK_ONHAND. Pastikan kolom <b>Stock Onhand</b> berisi angka lebih dari 0, dan header sheet tidak berubah.</div>';
      }
    }

    google.script.run.withSuccessHandler(function(data) {
      applyFrontendDatabase(data, 'getMasterData');
    }).withFailureHandler(function(err) {
      var msg = err && err.message ? err.message : String(err || 'Gagal memuat database dari Spreadsheet.');
      showDashboardError_('Gagal memuat master database. Mencoba jalur cepat STOCK_ONHAND... ' + msg);
      google.script.run.withSuccessHandler(function(data) {
        applyFrontendDatabase(data, 'getFrontendDatabaseData');
      }).withFailureHandler(function(err2) {
        masterLoaded = false;
        showDashboardError_('Gagal membaca database dari Spreadsheet: ' + escapeHtml((err2 && err2.message) || err2 || msg));
        loadDashboardSummaryData(true);
      }).getFrontendDatabaseData({ auth: getAuthPayload(), onlyAvailableStock: true });
    }).getMasterData();
  }

  function normalizeMasterDataClient_(data) {
    data = data || {};
    return {
      barang: Array.isArray(data.barang) ? data.barang : [],
      status: Array.isArray(data.status) ? data.status : [],
      koordinator: Array.isArray(data.koordinator) ? data.koordinator : [],
      rak: Array.isArray(data.rak) ? data.rak : [],
      rakLastOut: Array.isArray(data.rakLastOut) ? data.rakLastOut : [],
      rakKapasitas: Array.isArray(data.rakKapasitas) ? data.rakKapasitas : [],
      stock: normalizeStockListClient_(data.stock),
      lotRakBatch: Array.isArray(data.lotRakBatch) ? data.lotRakBatch : [],
      resto: Array.isArray(data.resto) ? data.resto : [],
      otdr: Array.isArray(data.otdr) ? data.otdr : [],
      syncWarning: data.syncWarning || ''
    };
  }

  function normalizeStockListClient_(rows) {
    rows = Array.isArray(rows) ? rows : [];
    return rows.map(function(s) {
      s = s || {};
      s.stockOnhand = Number(String(s.stockOnhand || 0).replace(',', '.').replace(/[^0-9.\-]/g, '')) || 0;
      s.qtyMasuk = Number(String(s.qtyMasuk || 0).replace(',', '.').replace(/[^0-9.\-]/g, '')) || 0;
      s.qtyKeluar = Number(String(s.qtyKeluar || 0).replace(',', '.').replace(/[^0-9.\-]/g, '')) || 0;
      return s;
    });
  }

  function renderDashboardLoading_() {
    text('dash_total_qty', '...');
    text('dash_total_lot', '...');
    text('dash_exp_soon', '...');
    text('dash_otdr_pending', '...');
    if (byId('dash_exp_table')) byId('dash_exp_table').innerHTML = '<div class="empty">Memuat database stock dari Spreadsheet...</div>';
  }

  function showDashboardError_(message) {
    if (byId('dash_exp_table')) byId('dash_exp_table').innerHTML = '<div class="empty">' + escapeHtml(message) + '</div>';
  }

  function showMasterSyncWarning_() {
    if (master && master.syncWarning && byId('dash_exp_table')) {
      var currentHtml = byId('dash_exp_table').innerHTML || '';
      byId('dash_exp_table').innerHTML = '<div class="msg warn">Relasi LOT/Rak/Batch belum tersinkron penuh: ' + escapeHtml(master.syncWarning) + '</div>' + currentHtml;
    }
  }

  function populateAllSelects() {
    fillSelect('in_namaBarang', master.barang.map(function(x) { return { value:x.nama, label:x.nama }; }), true, '-- Pilih Barang --');
    renderRestoOptions(val('out_restoSearch'));
    fillSelect('in_status', master.status.map(toOption), true, '-- Pilih Status --');
    fillSelect('in_shiftIn', master.koordinator.map(toOption), true, '-- Pilih Koordinator --');
    fillSelect('out_shiftOut', master.koordinator.map(toOption), true, '-- Pilih Koordinator --');
    fillSelect('loc_pic', master.koordinator.map(toOption), true, '-- Pilih PIC --');
    fillRackSelect('in_lokasiRak', true);
    refreshInboundBatchRackSelects();
    fillRackSelect('loc_lokasiBaru', false);
    var lokasiStatusOptions = master.status.map(toOption);
    if (currentUser && !currentUser.access.supervisor && currentUser.access.lokasi) {
      lokasiStatusOptions = lokasiStatusOptions.filter(function(opt) {
        var key = String(opt.value || '').toUpperCase().trim();
        return key === 'GOOD' || key === 'HOLD';
      });
    }
    fillSelect('loc_statusBaru', [{value:'', label:'-- Status Tetap --'}].concat(lokasiStatusOptions), false);
    fillSelect('mut_namaBarang', [{value:'', label:'Semua'}].concat(master.barang.map(function(x) { return { value:x.nama, label:x.nama }; })), false);
    fillSelect('mut_status', [{value:'', label:'Semua'}].concat(master.status.map(toOption)), false);
    fillSelect('rep_namaBarang', [{value:'', label:'Semua'}].concat(master.barang.map(function(x) { return { value:x.nama, label:x.nama }; })), false);
    fillSelect('rep_status', [{value:'', label:'Semua'}].concat(master.status.map(toOption)), false);
    refreshFifoQcFilterOptions_(fifoQcRows && fifoQcRows.length ? fifoQcRows : (master.stock || []));
    fillSelect('rep_io_namaBarang', [{value:'', label:'Semua'}].concat(master.barang.map(function(x) { return { value:x.nama, label:x.nama }; })), false);
    fillSelect('op_namaBarang', [{value:'', label:'Semua'}].concat(master.barang.map(function(x) { return { value:x.nama, label:x.nama }; })), false);
    fillSelect('op_status', [{value:'', label:'Semua'}].concat(master.status.map(toOption)), false);
    renderStockOpnameRackOptions();
    renderRackCapacityEditor();
    refreshLocationStockOptions();
    applyBarangDefault('in');
    applyRestoDefault();
    refreshAllOutputLineSelects();
    applyUserPermissions();
  }

  function toOption(v) { return { value:v, label:v }; }

  function fillSelect(id, arr, required, placeholder) {
    var select = byId(id);
    if (!select) return;
    var html = required ? '<option value="">' + escapeHtml(placeholder || '-- Pilih --') + '</option>' : '';
    arr.forEach(function(opt) {
      if (!opt) return;
      html += '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + '</option>';
    });
    select.innerHTML = html;
  }
  function normalizeSearchTextClient(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function getRestoSearchHaystack(resto) {
    return normalizeSearchTextClient([
      resto && resto.kode,
      resto && resto.nama,
      resto && resto.nopol,
      resto && resto.wa,
      resto && resto.sopir,
      resto && resto.keterangan,
      resto && resto.label
    ].join(' '));
  }

  function renderRestoOptions(keyword) {
    var select = byId('out_restoId');
    if (!select) return;
    var current = select.value;
    var q = normalizeSearchTextClient(keyword);
    var rows = (master.resto || []).filter(function(resto) {
      if (!q) return true;
      return getRestoSearchHaystack(resto).indexOf(q) !== -1;
    });
    var maxShow = 80;
    var html = '<option value="">-- Pilih Kode Resto --</option>';
    rows.slice(0, maxShow).forEach(function(x) {
      var label = (x.kode || '-') + ' - ' + (x.nama || '-') + ' | Nopol: ' + (x.nopol || '-') + ' | Sopir: ' + (x.sopir || '-') + ' | WA: ' + (x.wa || '-');
      html += '<option value="' + escapeHtml(x.id) + '">' + escapeHtml(label) + '</option>';
    });
    if (!rows.length) html += '<option value="" disabled>Tidak ada resto yang cocok</option>';
    if (rows.length > maxShow) html += '<option value="" disabled>Menampilkan ' + maxShow + ' dari ' + rows.length + ' hasil. Persempit kata kunci.</option>';
    select.innerHTML = html;

    var stillExists = rows.some(function(x) { return x.id === current; });
    if (stillExists) select.value = current;
    else if (q && rows.length === 1) select.value = rows[0].id;
    applyRestoDefault();
  }

  function handleRestoSearchKey(ev) {
    if (!ev) return;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      var select = byId('out_restoId');
      if (select && select.options.length > 1) {
        select.selectedIndex = 1;
        applyRestoDefault();
      }
    }
  }


  function handleSearchSelectKey(ev, selectId, afterSelect) {
    if (!ev || ev.key !== 'Enter') return;
    ev.preventDefault();
    var select = byId(selectId);
    if (!select) return;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value && !select.options[i].disabled) {
        select.selectedIndex = i;
        if (typeof afterSelect === 'function') afterSelect();
        else if (typeof window[afterSelect] === 'function') window[afterSelect]();
        return;
      }
    }
  }

  function handleOutputLocationSearchKey(ev, id) {
    handleSearchSelectKey(ev, 'out_line_lokasi_' + id, function() { refreshOutputStockOptions(id); });
  }

  function rackSearchHaystackClient(rak, item, lastOut) {
    return normalizeSearchTextClient([
      rak,
      item && item.idStock,
      item && item.namaBarang,
      item && item.lokasiRak,
      item && item.tanggalProduksi,
      item && item.tanggalExpired,
      item && item.status,
      item && item.nomorBSTB,
      item && item.nomorBatch,
      item && item.satuan,
      item && item.namaUserInputTerakhir,
      lastOut && lastOut.tanggalKeluar,
      lastOut && lastOut.timestampKeluar,
      lastOut && lastOut.namaBarang,
      lastOut && lastOut.qtyKeluar,
      lastOut && lastOut.satuan,
      lastOut && lastOut.nomorSuratJalan,
      lastOut && lastOut.nomorITKirim,
      lastOut && lastOut.idStock,
      lastOut && lastOut.nomorBSTB,
      lastOut && lastOut.nomorBatch,
      lastOut && lastOut.kodeResto,
      lastOut && lastOut.namaResto,
      lastOut && lastOut.shiftKoordinator,
      lastOut && lastOut.namaUserTransaksi,
      lastOut && lastOut.keterangan
    ].join(' '));
  }

  function getRackLastOutMapClient() {
    var map = {};
    (master.rakLastOut || []).forEach(function(item) {
      var key = String(item.lokasiRak || '').toUpperCase().trim();
      if (!key) return;
      map[key] = item;
    });
    return map;
  }

  function getRackLastOutClient(rak) {
    return getRackLastOutMapClient()[String(rak || '').toUpperCase().trim()] || null;
  }

  function formatRackLastOutLabelClient(info) {
    if (!info) return '';
    return ' | TERAKHIR KELUAR: ' + (info.tanggalKeluar || '-') +
      ' | ' + (info.namaBarang || '-') +
      ' | Qty: ' + (info.qtyKeluar || 0) + ' ' + (info.satuan || '') +
      ' | SJ: ' + (info.nomorSuratJalan || '-') +
      ' | Batch: ' + (info.nomorBatch || '-') +
      ' | Tujuan: ' + (info.kodeResto || '-') + ' ' + (info.namaResto || '');
  }

  function showInboundRackInfo() {
    var el = byId('in_lokasiRak_info');
    if (!el) return;
    var rak = val('in_lokasiRak');
    var info = getRackLastOutClient(rak);
    if (!rak || !info) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = '<b>Info rak:</b> Rak ' + escapeHtml(rak) +
      ' terakhir ada transaksi keluar pada <b>' + escapeHtml(info.tanggalKeluar || '-') + '</b>' +
      ' untuk barang <b>' + escapeHtml(info.namaBarang || '-') + '</b>, qty ' + escapeHtml(info.qtyKeluar || 0) + ' ' + escapeHtml(info.satuan || '') +
      '. SJ: ' + escapeHtml(info.nomorSuratJalan || '-') +
      ', batch: ' + escapeHtml(info.nomorBatch || '-') +
      ', tujuan: ' + escapeHtml((info.kodeResto || '-') + ' - ' + (info.namaResto || '-')) +
      ', koordinator: ' + escapeHtml(info.shiftKoordinator || info.namaUserTransaksi || '-') + '.';
  }

  function fillRackSelect(id, required) {
    var select = byId(id);
    if (!select) return;
    var current = select.value;
    var searchEl = byId(id + '_search');
    var q = normalizeSearchTextClient(searchEl ? searchEl.value : '');
    var occupancy = getRackOccupancyClient();
    var lastOutMap = getRackLastOutMapClient();
    var isInboundRack = id === 'in_lokasiRak' || id.indexOf('in_batch_lokasi_') === 0;
    var header = required
      ? (isInboundRack ? '<option value="">-- Pilih Rak Tujuan --</option>' : '<option value="">-- Pilih Rak --</option>')
      : (id === 'loc_lokasiBaru' ? '<option value="">-- Tidak Ubah Lokasi --</option>' : '<option value="">-- Semua Rak --</option>');
    var html = header;
    var shown = 0;
    (master.rak || []).forEach(function(rak) {
      if (!rak) return;
      var rackKey = String(rak).toUpperCase().trim();
      var item = occupancy[rackKey];
      var lastOut = lastOutMap[rackKey];
      if (q && rackSearchHaystackClient(rak, item, lastOut).indexOf(q) === -1) return;
      shown++;
      if (item) {
        var batchListText = item.batchList && item.batchList.length ? item.batchList.slice(0, 5).join(', ') : (item.nomorBatch || '-');
        var occupiedLabel = rak + ' - AKTIF: ' + (item.lotCount || 1) + ' batch/lot | Total Stock ' + (item.totalStock || item.stockOnhand || 0) + ' | Batch: ' + batchListText + ' | Contoh: ' + (item.namaBarang || '-') + ' Exp: ' + (item.tanggalExpired || '-');
        html += '<option value="' + escapeHtml(rak) + '">' + escapeHtml(occupiedLabel) + '</option>';
      } else {
        var emptyLabel = rak + ' - KOSONG' + formatRackLastOutLabelClient(lastOut);
        html += '<option value="' + escapeHtml(rak) + '">' + escapeHtml(emptyLabel) + '</option>';
      }
    });
    if (!shown) html += '<option value="" disabled>Tidak ada rak/lokasi yang cocok dengan pencarian</option>';
    select.innerHTML = html;
    if (current) {
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === current && !select.options[i].disabled) {
          select.value = current;
          break;
        }
      }
    }
    if (id === 'in_lokasiRak') showInboundRackInfo();
  }


  function addInboundBatchLine(row) {
    row = row || {};
    inboundBatchCounter += 1;
    var id = inboundBatchCounter;
    var wrap = byId('in_batch_lines');
    if (!wrap) return;

    var div = document.createElement('div');
    div.className = 'batch-line card';
    div.setAttribute('data-id', id);
    div.style.margin = '8px 0';
    div.style.padding = '8px';
    div.innerHTML =
      '<div class="section-title" style="margin-bottom:6px;"><span>Batch</span><div>Batch Tambahan #' + id + '</div></div>' +
      '<div class="grid2">' +
        '<div><label>Nomor Batch</label><input type="text" id="in_batch_nomor_' + id + '" placeholder="Contoh: BATCH-002"></div>' +
        '<div><label>Qty Batch</label><input type="text" id="in_batch_qty_' + id + '" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Contoh: 50"></div>' +
      '</div>' +
      '<label>Lokasi Rak Batch</label>' +
      '<div class="search-select-box">' +
        '<input type="search" id="in_batch_lokasi_' + id + '_search" placeholder="Cari rak tujuan untuk batch ini..." autocomplete="off">' +
        '<select id="in_batch_lokasi_' + id + '"></select>' +
      '</div>' +
      '<label>Keterangan Batch</label><input type="text" id="in_batch_keterangan_' + id + '" placeholder="Opsional: catatan khusus batch ini">' +
      '<button type="button" class="danger" onclick="removeInboundBatchLine(' + id + ')">🗑️ Hapus Batch Ini</button>';
    wrap.appendChild(div);

    var qtyEl = byId('in_batch_qty_' + id);
    if (qtyEl) {
      qtyEl.onkeydown = function(event) { return preventQtyDecimal(event); };
      qtyEl.oninput = function() { normalizeQtyInput(qtyEl); };
      qtyEl.onpaste = function() { setTimeout(function() { normalizeQtyInput(qtyEl); }, 0); };
    }

    var searchEl = byId('in_batch_lokasi_' + id + '_search');
    if (searchEl) {
      searchEl.oninput = function() { fillRackSelect('in_batch_lokasi_' + id, true); };
      searchEl.onkeydown = function(event) { handleSearchSelectKey(event, 'in_batch_lokasi_' + id); };
    }

    fillRackSelect('in_batch_lokasi_' + id, true);
    if (row.nomorBatch) byId('in_batch_nomor_' + id).value = row.nomorBatch;
    if (row.qty) byId('in_batch_qty_' + id).value = row.qty;
    if (row.lokasiRak) byId('in_batch_lokasi_' + id).value = row.lokasiRak;
    if (row.keterangan) byId('in_batch_keterangan_' + id).value = row.keterangan;
  }

  function removeInboundBatchLine(id) {
    var el = document.querySelector('.batch-line[data-id="' + id + '"]');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function refreshInboundBatchRackSelects() {
    Array.prototype.forEach.call(document.querySelectorAll('.batch-line'), function(el) {
      var id = el.getAttribute('data-id');
      fillRackSelect('in_batch_lokasi_' + id, true);
    });
  }

  function collectInboundBatches() {
    var rows = [];
    var first = {
      nomorBatch: val('in_nomorBatch'),
      qty: val('in_qty'),
      lokasiRak: val('in_lokasiRak'),
      keterangan: val('in_keterangan')
    };
    if (first.nomorBatch || first.qty || first.lokasiRak || first.keterangan) rows.push(first);

    Array.prototype.forEach.call(document.querySelectorAll('.batch-line'), function(el) {
      var id = el.getAttribute('data-id');
      var row = {
        nomorBatch: val('in_batch_nomor_' + id),
        qty: val('in_batch_qty_' + id),
        lokasiRak: val('in_batch_lokasi_' + id),
        keterangan: val('in_batch_keterangan_' + id)
      };
      if (row.nomorBatch || row.qty || row.lokasiRak || row.keterangan) rows.push(row);
    });
    return rows;
  }

  function validateInboundBatchesClient(rows) {
    if (!rows.length) return 'Minimal isi 1 batch: Nomor Batch/Qty/Lokasi Rak.';
    var usedRackBatch = {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      var no = i + 1;
      if (!row.nomorBatch) return 'Nomor Batch baris ' + no + ' wajib diisi.';
      if (!row.qty) return 'Qty batch baris ' + no + ' wajib diisi.';
      if (!isPositiveIntegerString(row.qty)) return 'Qty batch baris ' + no + ' harus angka bulat tanpa koma/desimal.';
      if (!row.lokasiRak) return 'Lokasi Rak batch baris ' + no + ' wajib dipilih.';
      var rackBatchKey = String(row.lokasiRak || '').toUpperCase().trim() + '|' + String(row.nomorBatch || '').toUpperCase().trim();
      if (usedRackBatch[rackBatchKey]) return 'Nomor Batch ' + row.nomorBatch + ' pada Rak ' + row.lokasiRak + ' diinput lebih dari 1 baris. Gabungkan qty batch tersebut dalam 1 baris.';
      usedRackBatch[rackBatchKey] = true;
    }
    return '';
  }

  function summarizeInboundBatchesClient(rows) {
    var totalQty = 0;
    var lines = [];
    (rows || []).forEach(function(row, idx) {
      var qty = Number(row.qty || 0);
      totalQty += qty;
      lines.push((idx + 1) + '. Batch: ' + (row.nomorBatch || '-') + ' | Qty: ' + qty + ' ' + val('in_satuan') + ' | Rak: ' + (row.lokasiRak || '-'));
    });
    return { totalQty: totalQty, lines: lines };
  }

  function clearInboundBatchInputs() {
    byId('in_qty').value = '';
    byId('in_nomorBatch').value = '';
    byId('in_lokasiRak_search').value = '';
    byId('in_lokasiRak').value = '';
    byId('in_waktuCSMenit').value = '';
    byId('in_nomorBSTB').value = '';
    byId('in_nomorITKirim').value = '';
    byId('in_keterangan').value = '';
    byId('in_batch_lines').innerHTML = '';
    inboundBatchCounter = 0;
    showInboundRackInfo();
  }


  function getRackOccupancyClient() {
    var map = {};
    (master.stock || []).forEach(function(s) {
      var rak = String(s.lokasiRak || '').toUpperCase().trim();
      if (!rak || Number(s.stockOnhand || 0) <= 0) return;
      if (!map[rak]) {
        map[rak] = {
          idStock: s.idStock,
          namaBarang: s.namaBarang,
          lokasiRak: s.lokasiRak,
          tanggalProduksi: s.tanggalProduksi,
          tanggalExpired: s.tanggalExpired,
          status: s.status,
          nomorBSTB: s.nomorBSTB,
          nomorBatch: s.nomorBatch,
          satuan: s.satuan,
          namaUserInputTerakhir: s.namaUserInputTerakhir,
          stockOnhand: Number(s.stockOnhand || 0),
          totalStock: 0,
          lotCount: 0,
          batchList: []
        };
      }
      map[rak].lotCount += 1;
      map[rak].totalStock += Number(s.stockOnhand || 0);
      if (s.nomorBatch && map[rak].batchList.indexOf(s.nomorBatch) === -1) map[rak].batchList.push(s.nomorBatch);
    });
    return map;
  }

  function isRackOccupiedClient(rak) { return !!getRackOccupancyClient()[String(rak || '').toUpperCase().trim()]; }

  function applyBarangDefault(prefix) {
    var nama = byId(prefix + '_namaBarang') ? byId(prefix + '_namaBarang').value : '';
    var item = master.barang.find(function(x) { return x.nama === nama; });
    if (!item) return;
    var satuanEl = byId(prefix + '_satuan');
    if (satuanEl && item.satuan) satuanEl.value = item.satuan;
    if (prefix === 'in') {
      if (item.status) byId('in_status').value = item.status;
      if (item.expiredBulan) byId('in_expiredBulan').value = item.expiredBulan;
      byId('in_lokasiRak').value = item.rak || '';
      showInboundRackInfo();
      calculateExpiredAuto();
    }
  }

  function calculateExpiredAuto() {
    var produksi = val('in_tanggalProduksi');
    var nama = val('in_namaBarang');
    var item = master.barang.find(function(x) { return x.nama === nama; });
    var bulan = Number((item && item.expiredBulan) ? item.expiredBulan : val('in_expiredBulan') || 0);
    if (item && item.expiredBulan) byId('in_expiredBulan').value = item.expiredBulan;
    if (!produksi || bulan <= 0) { byId('in_tanggalExpired').value = ''; return; }
    var base = new Date(produksi + 'T00:00:00');
    var targetMonth = base.getMonth() + bulan;
    var first = new Date(base.getFullYear(), targetMonth, 1);
    var lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    first.setDate(Math.min(base.getDate(), lastDay));
    byId('in_tanggalExpired').value = first.getFullYear() + '-' + String(first.getMonth() + 1).padStart(2, '0') + '-' + String(first.getDate()).padStart(2, '0');
  }

  function applyRestoDefault() {
    var resto = (master.resto || []).find(function(x) { return x.id === val('out_restoId'); });
    byId('out_nopol').value = resto ? resto.nopol : '';
    byId('out_waSopir').value = resto ? resto.wa : '';
    byId('out_namaSopir').value = resto ? resto.sopir : '';
    var info = byId('out_restoSelectedInfo');
    if (info) {
      info.innerHTML = resto
        ? '<b>Tujuan terpilih:</b> ' + escapeHtml((resto.kode || '-') + ' - ' + (resto.nama || '-')) + '<br><span>Nopol: ' + escapeHtml(resto.nopol || '-') + ' | Sopir: ' + escapeHtml(resto.sopir || '-') + ' | WA: ' + escapeHtml(resto.wa || '-') + '</span>'
        : 'Ketik kata kunci untuk mempercepat pencarian tujuan resto.';
    }
  }

  var adminItLineCounter = 0;

  function ensureAdminItRows() {
    var body = byId('admin_it_rows');
    if (!body) return;
    if (!body.querySelector('tr')) {
      addAdminItRow();
      addAdminItRow();
      addAdminItRow();
    }
  }

  function addAdminItRow() {
    var body = byId('admin_it_rows');
    if (!body) return;

    adminItLineCounter++;
    var id = adminItLineCounter;
    var today = new Date().toISOString().slice(0, 10);
    var tr = document.createElement('tr');
    tr.setAttribute('data-id', id);
    tr.innerHTML =
      '<td>' + id + '</td>' +
      '<td><input type="date" id="admin_it_tanggal_' + id + '" value="' + today + '"></td>' +
      '<td><select id="admin_it_jenis_' + id + '"><option value="TERIMA">IT Terima</option><option value="KIRIM">IT Kirim</option><option value="TERIMA & KIRIM">Terima & Kirim</option></select></td>' +
      '<td><input type="text" id="admin_it_terima_' + id + '" placeholder="Contoh: IT-T-001"></td>' +
      '<td><input type="text" id="admin_it_kirim_' + id + '" placeholder="Contoh: IT-K-001"></td>' +
      '<td><input type="text" id="admin_it_ref_' + id + '" placeholder="BSTB / SJ / dokumen"></td>' +
      '<td><input type="text" id="admin_it_kode_' + id + '" placeholder="Kode resto / supplier"></td>' +
      '<td><input type="text" id="admin_it_item_' + id + '" placeholder="Nama barang / keterangan item"></td>' +
      '<td><input type="text" id="admin_it_qty_' + id + '" inputmode="numeric" placeholder="Qty"></td>' +
      '<td><input type="text" id="admin_it_catatan_' + id + '" placeholder="Catatan"></td>' +
      '<td><button type="button" class="danger" style="width:auto;padding:7px 10px;margin:0;" onclick="removeAdminItRow(' + id + ')">Hapus</button></td>';
    body.appendChild(tr);
  }

  function removeAdminItRow(id) {
    var row = document.querySelector('#admin_it_rows tr[data-id="' + id + '"]');
    if (row) row.remove();
    ensureAdminItRows();
  }

  function collectAdminItRows() {
    var rows = [];
    Array.prototype.forEach.call(document.querySelectorAll('#admin_it_rows tr'), function(tr) {
      var id = tr.getAttribute('data-id');
      var row = {
        tanggalIT: val('admin_it_tanggal_' + id),
        jenisIT: val('admin_it_jenis_' + id),
        nomorITTerima: val('admin_it_terima_' + id),
        nomorITKirim: val('admin_it_kirim_' + id),
        nomorReferensi: val('admin_it_ref_' + id),
        kodeRestoSupplier: val('admin_it_kode_' + id),
        namaBarangKet: val('admin_it_item_' + id),
        qty: val('admin_it_qty_' + id),
        catatan: val('admin_it_catatan_' + id)
      };
      if (row.nomorITTerima || row.nomorITKirim || row.nomorReferensi || row.kodeRestoSupplier || row.namaBarangKet || row.qty || row.catatan) rows.push(row);
    });
    return rows;
  }

  function submitAdminItRows() {
    var rows = collectAdminItRows();
    if (!rows.length) {
      showMsg('msg_adminit', 'Minimal isi 1 baris nomor IT.', false);
      return;
    }

    showMsg('msg_adminit', 'Menyimpan nomor IT...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_adminit', res.message, true);
      byId('admin_it_rows').innerHTML = '';
      adminItLineCounter = 0;
      ensureAdminItRows();
      loadAdminItHistory();
    }).withFailureHandler(function(err) {
      showMsg('msg_adminit', err.message || err, false);
    }).submitAdminItRows({ rows: rows, auth: getAuthPayload() });
  }

  function loadAdminItHistory() {
    var wrap = byId('admin_it_history');
    if (!wrap) return;
    wrap.innerHTML = '<div class="empty">Memuat riwayat IT...</div>';
    google.script.run.withSuccessHandler(function(rows) {
      renderAdminItHistory(rows || []);
    }).withFailureHandler(function(err) {
      wrap.innerHTML = '<div class="empty">' + escapeHtml(err.message || err) + '</div>';
    }).getAdminItList({
      startDate: val('admin_it_startDate'),
      endDate: val('admin_it_endDate'),
      auth: getAuthPayload()
    });
  }

  function renderAdminItHistory(rows) {
    var wrap = byId('admin_it_history');
    if (!wrap) return;
    if (!rows.length) {
      wrap.innerHTML = '<div class="empty">Belum ada data IT pada tanggal yang dipilih.</div>';
      return;
    }

    var html = '<table><thead><tr>' +
      '<th>Tanggal IT</th><th>Jenis</th><th>IT Terima</th><th>IT Kirim</th><th>Referensi</th><th>Resto/Supplier</th><th>Item</th><th>Qty</th><th>Admin</th><th>Relasi</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      html += '<tr>' +
        '<td>' + escapeHtml(r.tanggalIT) + '<br><span class="small">Input: ' + escapeHtml(r.timestampInput) + '</span></td>' +
        '<td><span class="badge">' + escapeHtml(r.jenisIT) + '</span></td>' +
        '<td><b>' + escapeHtml(r.nomorITTerima || '-') + '</b></td>' +
        '<td><b>' + escapeHtml(r.nomorITKirim || '-') + '</b></td>' +
        '<td>' + escapeHtml(r.nomorReferensi || '-') + '</td>' +
        '<td>' + escapeHtml(r.kodeRestoSupplier || '-') + '</td>' +
        '<td>' + escapeHtml(r.namaBarangKet || '-') + '<br><span class="small">' + escapeHtml(r.catatan || '') + '</span></td>' +
        '<td>' + escapeHtml(r.qty || '-') + '</td>' +
        '<td>' + escapeHtml(r.namaAdmin || '-') + '</td>' +
        '<td>' + escapeHtml(r.sumberRelasi || '-') + '<br><span class="small">' + escapeHtml(r.statusRelasi || '') + '</span></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }


  function loadAdminItRelasi() {
    var wrap = byId('admin_it_relasi_result');
    if (!wrap) return;
    wrap.innerHTML = '<div class="empty">Mencari transaksi...</div>';
    showMsg('msg_adminit_relasi', 'Mencari transaksi berdasarkan tanggal...', true);
    google.script.run.withSuccessHandler(function(rows) {
      renderAdminItRelasi(rows || []);
      showMsg('msg_adminit_relasi', 'Data transaksi ditemukan: ' + (rows || []).length + ' baris/grup.', true);
    }).withFailureHandler(function(err) {
      wrap.innerHTML = '<div class="empty">' + escapeHtml(err.message || err) + '</div>';
      showMsg('msg_adminit_relasi', err.message || err, false);
    }).getAdminItTransactionCandidates({
      jenisTransaksi: val('admin_it_relasi_jenis'),
      startDate: val('admin_it_relasi_startDate'),
      endDate: val('admin_it_relasi_endDate'),
      auth: getAuthPayload()
    });
  }

  function renderAdminItRelasi(rows) {
    var wrap = byId('admin_it_relasi_result');
    if (!wrap) return;
    if (!rows.length) {
      wrap.innerHTML = '<div class="empty">Tidak ada transaksi pada tanggal yang dipilih.</div>';
      return;
    }

    var jenis = val('admin_it_relasi_jenis');
    var isMasuk = jenis === 'MASUK';
    var html = '<table><thead><tr>' +
      '<th>No</th><th>Tanggal</th><th>Referensi</th><th>Koordinator / Resto</th><th>Barang</th><th>Qty</th><th>Status/Lokasi</th>' +
      (isMasuk ? '<th>Isi IT Terima</th>' : '<th>Isi IT Kirim</th>') +
      '<th>Catatan Admin</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function(r, idx) {
      html += '<tr data-rowid="' + escapeHtml(r.rowId) + '" data-tipe="' + escapeHtml(r.tipe) + '">' +
        '<td>' + (idx + 1) + '<br><span class="small">Row: ' + escapeHtml(r.rowTransaksi || r.rowNumber || '') + '</span></td>' +
        '<td><b>' + escapeHtml(r.tanggal || '-') + '</b><br><span class="small">Input: ' + escapeHtml(r.timestampInput || '-') + '</span></td>' +
        '<td>' + escapeHtml(r.referensi || '-') + '</td>' +
        '<td>' + escapeHtml(r.kodeNama || '-') + '</td>' +
        '<td>' + escapeHtml(r.namaBarang || '-') + '<br><span class="small">User: ' + escapeHtml(r.userTransaksi || '-') + '</span></td>' +
        '<td><b>' + escapeHtml(r.qty || '0') + '</b> ' + escapeHtml(r.satuan || '') + '</td>' +
        '<td>' + escapeHtml(r.status || '-') + '<br><span class="small">' + escapeHtml(r.lokasi || '-') + '</span></td>';

      if (isMasuk) {
        html += '<td><input class="admin-rel-it-terima" type="text" placeholder="Nomor IT Terima" value="' + escapeHtml(r.nomorITTerima || '') + '"><div class="small">IT kirim lama: ' + escapeHtml(r.nomorITKirim || '-') + '</div></td>';
      } else {
        html += '<td><input class="admin-rel-it-kirim" type="text" placeholder="Nomor IT Kirim" value="' + escapeHtml(r.nomorITKirim || '') + '"></td>';
      }

      html += '<td><input class="admin-rel-catatan" type="text" placeholder="Catatan opsional"></td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function collectAdminItRelasiRows() {
    var rows = [];
    Array.prototype.forEach.call(document.querySelectorAll('#admin_it_relasi_result tbody tr'), function(tr) {
      var tipe = tr.getAttribute('data-tipe') || '';
      var rowId = tr.getAttribute('data-rowid') || '';
      var inputTerima = tr.querySelector('.admin-rel-it-terima');
      var inputKirim = tr.querySelector('.admin-rel-it-kirim');
      var catatan = tr.querySelector('.admin-rel-catatan');
      var nomorITTerima = inputTerima ? inputTerima.value.trim() : '';
      var nomorITKirim = inputKirim ? inputKirim.value.trim() : '';
      if (nomorITTerima || nomorITKirim) {
        rows.push({
          rowId: rowId,
          tipe: tipe,
          nomorITTerima: nomorITTerima,
          nomorITKirim: nomorITKirim,
          catatan: catatan ? catatan.value.trim() : ''
        });
      }
    });
    return rows;
  }

  function saveAdminItRelasi() {
    var rows = collectAdminItRelasiRows();
    if (!rows.length) {
      showMsg('msg_adminit_relasi', 'Isi minimal 1 nomor IT pada tabel hasil pencarian.', false);
      return;
    }

    showMsg('msg_adminit_relasi', 'Menyimpan relasi nomor IT ke database transaksi...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_adminit_relasi', res.message, true);
      loadAdminItRelasi();
      loadAdminItHistory();
      loadMasterData();
    }).withFailureHandler(function(err) {
      showMsg('msg_adminit_relasi', err.message || err, false);
    }).saveAdminItTransactionLinks({ rows: rows, auth: getAuthPayload() });
  }


  var pickingItemCounter = 0;

  function renderPickingRestoOptions(keyword) {
    var select = byId('pick_restoId');
    if (!select) return;
    var current = select.value;
    var q = normalizeSearchTextClient(keyword);
    var rows = (master.resto || []).filter(function(resto) {
      if (!q) return true;
      return getRestoSearchHaystack(resto).indexOf(q) !== -1;
    });
    var html = '<option value="">-- Pilih Tujuan / Resto --</option>';
    rows.slice(0, 80).forEach(function(x) {
      var label = (x.kode || '-') + ' - ' + (x.nama || '-') + ' | Nopol: ' + (x.nopol || '-') + ' | Sopir: ' + (x.sopir || '-');
      html += '<option value="' + escapeHtml(x.id) + '">' + escapeHtml(label) + '</option>';
    });
    if (!rows.length) html += '<option value="" disabled>Tidak ada resto yang cocok</option>';
    select.innerHTML = html;
    if (rows.some(function(x) { return x.id === current; })) select.value = current;
  }

  function ensurePickingItemRows() {
    var body = byId('pick_item_rows');
    if (!body) return;
    if (!body.querySelector('tr')) {
      addPickingItemRow();
      addPickingItemRow();
      addPickingItemRow();
    }
  }

  function addPickingItemRow() {
    var body = byId('pick_item_rows');
    if (!body) return;
    pickingItemCounter++;
    var id = pickingItemCounter;
    var tr = document.createElement('tr');
    tr.setAttribute('data-id', id);
    tr.innerHTML =
      '<td>' + id + '</td>' +
      '<td><select id="pick_item_barang_' + id + '"></select></td>' +
      '<td><input type="text" id="pick_item_qty_' + id + '" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Qty" onkeydown="return preventQtyDecimal(event)" oninput="normalizeQtyInput(this)" onpaste="var input=this; setTimeout(function(){ normalizeQtyInput(input); }, 0)"></td>' +
      '<td><select id="pick_item_satuan_' + id + '"><option value="Carton">Carton</option><option value="Pack">Pack</option><option value="Pcs">Pcs</option><option value="Kg">Kg</option></select></td>' +
      '<td><button type="button" class="danger" style="width:auto;padding:7px 10px;margin:0;" onclick="removePickingItemRow(' + id + ')">Hapus</button></td>';
    body.appendChild(tr);
    fillSelect('pick_item_barang_' + id, master.barang.map(function(x) { return { value:x.nama, label:x.nama }; }), true, '-- Pilih Barang --');
  }

  function removePickingItemRow(id) {
    var row = document.querySelector('#pick_item_rows tr[data-id="' + id + '"]');
    if (row) row.remove();
    ensurePickingItemRows();
  }

  function collectPickingItems() {
    var rows = [];
    Array.prototype.forEach.call(document.querySelectorAll('#pick_item_rows tr'), function(tr) {
      var id = tr.getAttribute('data-id');
      var item = {
        namaBarang: val('pick_item_barang_' + id),
        qtyPO: val('pick_item_qty_' + id),
        satuan: val('pick_item_satuan_' + id)
      };
      if (item.namaBarang || item.qtyPO) rows.push(item);
    });
    return rows;
  }

  function createPickingListFromPOClient() {
    var items = collectPickingItems();
    if (!val('pick_nomorPO')) { showMsg('msg_pick', 'Nomor PO wajib diisi.', false); return; }
    if (!val('pick_tanggalMuat')) { showMsg('msg_pick', 'Tanggal muat wajib diisi.', false); return; }
    if (!items.length) { showMsg('msg_pick', 'Minimal isi 1 item PO.', false); return; }

    showMsg('msg_pick', 'Membuat picking list FEFO berdasarkan PO...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_pick', res.message, true);

      // Setelah berhasil dibuat, langsung arahkan filter riwayat ke PO yang baru dibuat
      // supaya user bisa melihat hasil picking list tanpa mencari manual.
      if (byId('pick_hist_keyword')) byId('pick_hist_keyword').value = (res && res.nomorPO) ? res.nomorPO : val('pick_nomorPO');
      if (byId('pick_hist_startDate')) byId('pick_hist_startDate').value = val('pick_tanggalMuat');
      if (byId('pick_hist_endDate')) byId('pick_hist_endDate').value = val('pick_tanggalMuat');

      byId('pick_item_rows').innerHTML = '';
      pickingItemCounter = 0;
      ensurePickingItemRows();
      loadPickingListHistory();

      setTimeout(function() {
        var target = byId('pick_history');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }).withFailureHandler(function(err) {
      showMsg('msg_pick', err.message || err, false);
    }).createPickingListFromPO({
      nomorPO: val('pick_nomorPO'),
      tanggalMuat: val('pick_tanggalMuat'),
      restoId: val('pick_restoId'),
      nomorSuratJalan: val('pick_nomorSJ'),
      catatan: val('pick_catatan'),
      items: items,
      auth: getAuthPayload()
    });
  }

  function loadPickingListHistory() {
    var wrap = byId('pick_history');
    if (!wrap) return;
    wrap.innerHTML = '<div class="empty">Memuat picking list...</div>';
    showMsg('msg_pick_history', 'Mengambil data picking list...', true);
    google.script.run.withSuccessHandler(function(rows) {
      rows = rows || [];
      renderPickingListHistory(rows);
      showMsg('msg_pick_history', 'Data picking list ditemukan: ' + rows.length + ' baris.', true);
    }).withFailureHandler(function(err) {
      var msg = err && err.message ? err.message : err;
      wrap.innerHTML = '<div class="empty">Gagal memuat picking list: ' + escapeHtml(msg) + '</div>';
      showMsg('msg_pick_history', 'Gagal memuat picking list: ' + msg, false);
    }).getPickingListAdmin({
      startDate: val('pick_hist_startDate'),
      endDate: val('pick_hist_endDate'),
      keyword: val('pick_hist_keyword'),
      auth: getAuthPayload()
    });
  }

  function clearPickingListHistoryFilter() {
    if (byId('pick_hist_startDate')) byId('pick_hist_startDate').value = '';
    if (byId('pick_hist_endDate')) byId('pick_hist_endDate').value = '';
    if (byId('pick_hist_keyword')) byId('pick_hist_keyword').value = '';
    loadPickingListHistory();
  }

  function createBarangKeluarFromPickingListClient() {
    var nomorPO = val('pick_hist_keyword') || val('pick_nomorPO');
    if (!nomorPO) {
      showMsg('msg_pick_history', 'Isi/pilih Nomor PO di filter riwayat atau di form Picking List dulu.', false);
      return;
    }
    var yakin = confirm('Buat BARANG_KELUAR dari Picking List PO/filter: ' + nomorPO + '?\\n\\nSetelah berhasil, status picking akan menjadi SUDAH BARANG KELUAR dan tidak bisa diproses ulang agar tidak double input.');
    if (!yakin) return;

    showMsg('msg_pick_history', 'Membuat BARANG_KELUAR dari picking list...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_pick_history', res.message || 'Barang keluar dari picking list berhasil dibuat.', true);
      loadPickingListHistory();
      loadMasterData();
      if (typeof loadBarangKeluarEditList === 'function') {
        // Tidak memaksa pencarian edit, tapi master data/OTDR sudah di-refresh.
      }
    }).withFailureHandler(function(err) {
      var msg = err && err.message ? err.message : err;
      showMsg('msg_pick_history', msg, false);
    }).submitBarangKeluarFromPickingList({
      nomorPO: nomorPO,
      auth: getAuthPayload()
    });
  }

  function renderPickingListHistory(rows) {
    var wrap = byId('pick_history');
    if (!wrap) return;
    if (!rows.length) {
      wrap.innerHTML = '<div class="empty">Belum ada picking list pada filter ini. Klik <b>Tampilkan Semua</b> atau kosongkan filter tanggal/keyword untuk melihat seluruh riwayat.</div>';
      return;
    }
    var html = '<div class="form-table-wrap"><table class="form-table"><thead><tr>' +
      '<th>PO / Tanggal</th><th>Tujuan</th><th>Barang</th><th>Qty PO</th><th>Qty Pick</th><th>Lokasi / Batch</th><th>Status</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      html += '<tr>' +
        '<td><b>' + escapeHtml(r.nomorPO) + '</b><br><span class="small">' + escapeHtml(r.tanggalMuat) + '<br>SJ: ' + escapeHtml(r.nomorSuratJalan || '-') + '</span></td>' +
        '<td>' + escapeHtml((r.kodeResto || '-') + ' - ' + (r.namaResto || '-')) + '<br><span class="small">' + escapeHtml(r.nopol || '-') + ' | ' + escapeHtml(r.namaSopir || '-') + '</span></td>' +
        '<td><b>' + escapeHtml(r.namaBarang) + '</b><br><span class="small">ID: ' + escapeHtml(r.idStock || '-') + '</span></td>' +
        '<td>' + formatNumber(r.qtyPO) + ' ' + escapeHtml(r.satuan) + '</td>' +
        '<td><b>' + formatNumber(r.qtyPick) + '</b></td>' +
        '<td>' + escapeHtml(r.lokasiRak || '-') + '<br><span class="small">Batch: ' + escapeHtml(r.nomorBatch || '-') + '<br>Exp: ' + escapeHtml(r.tanggalExpired || '-') + '</span></td>' +
        '<td><span class="badge">' + escapeHtml(r.statusPicking || '-') + '</span><br><span class="small">By: ' + escapeHtml(r.dibuatOleh || '-') + '<br>OTDR: ' + escapeHtml(r.idOtdr || '-') + '<br>BK Row: ' + escapeHtml(r.rowBarangKeluar || '-') + '</span></td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }


  function printPickingListClient() {
    var printWin = window.open('', '_blank');
    if (!printWin) {
      showMsg('msg_pick_history', 'Popup cetak diblokir browser. Izinkan popup lalu klik Cetak Picking List lagi.', false);
      return;
    }
    printWin.document.open();
    printWin.document.write('<html><head><title>Memuat Picking List</title></head><body style="font-family:Arial,sans-serif;padding:24px;">Memuat data picking list...</body></html>');
    printWin.document.close();

    var printKey = val('pick_hist_keyword') || val('pick_nomorPO');
    showMsg('msg_pick_history', 'Menyiapkan format cetak picking list berdasarkan nomor rak + FEFO...', true);
    google.script.run.withSuccessHandler(function(data) {
      renderPickingListPrintWindow(data, printWin);
      showMsg('msg_pick_history', 'Picking list siap dicetak. Urutan cetak: nomor rak lalu FEFO produk sesuai qty PO.', true);
    }).withFailureHandler(function(err) {
      var msg = err && err.message ? err.message : err;
      try {
        printWin.document.open();
        printWin.document.write('<html><body style="font-family:Arial,sans-serif;padding:24px;"><h3>Gagal menyiapkan picking list</h3><p>' + escapeHtml(msg) + '</p></body></html>');
        printWin.document.close();
      } catch (e) {}
      showMsg('msg_pick_history', 'Gagal cetak picking list: ' + msg, false);
    }).getPickingListPrintData({
      startDate: val('pick_hist_startDate'),
      endDate: val('pick_hist_endDate'),
      nomorPO: printKey,
      keyword: printKey,
      auth: getAuthPayload()
    });
  }

  function renderPickingListPrintWindow(data, printWin) {
    data = data || {};
    var rows = data.rows || [];
    var rowsPerPage = 40;

    function pickText(value, fallback) {
      value = value === null || value === undefined ? '' : String(value);
      value = value.trim();
      return value || (fallback || '');
    }

    function splitPages(list, size) {
      var pages = [];
      if (!list || !list.length) return [[]];
      for (var i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
      return pages;
    }

    function numberValue(value) {
      if (value === null || value === undefined || value === '') return 0;
      var n = Number(String(value).replace(/\./g, '').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    }

    function makeLine(label, value, isArea) {
      return '<div class="meta-line' + (isArea ? ' area-line' : '') + '">' +
        '<span class="meta-label">' + escapeHtml(label) + '</span>' +
        '<span class="colon">:</span>' +
        '<span class="meta-value">' + escapeHtml(value || '') + '</span>' +
      '</div>';
    }

    function getKodeBarang(r) {
      // Sheet PICKING_LIST belum memiliki kolom Kode Barang khusus.
      // Untuk form cetak, kolom ini diisi ID Stock sebagai kode internal lot.
      return pickText(r.kodeBarang || r.idStock || r.nomorBatch, '');
    }

    function getCatatanRow(r) {
      var notes = [];
      if (r.nomorBatch) notes.push('Batch: ' + r.nomorBatch);
      if (r.tanggalExpired) notes.push('Exp: ' + r.tanggalExpired);
      if (r.statusStock) notes.push(r.statusStock);
      return notes.join(' | ');
    }

    var pages = splitPages(rows, rowsPerPage);
    var totalQty = rows.reduce(function(sum, r) { return sum + numberValue(r.qtyPick || 0); }, 0);

    // Logo header cetak memakai data URI agar langsung tampil di pop-up print tanpa akses file eksternal.
    var logoPpaSrc = 'data:image/png;base64,' +
      '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';
    var logoGacoanSrc = 'data:image/png;base64,' +
      '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';
    var html = '';

    html += '<html><head><title>Form Picking List ' + escapeHtml(data.nomorPO || '') + '</title>';
    html += '<style>';
    html += '@page{size:A4 portrait;margin:8mm;}';
    html += '*{box-sizing:border-box;}';
    html += 'body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;background:#fff;font-size:8.8px;}';
    html += '.no-print{padding:10px 0 8px;text-align:left;}';
    html += '.print-btn{padding:8px 14px;font-weight:700;border:1px solid #111;background:#fff;cursor:pointer;}';
    html += '.doc-page{width:194mm;min-height:281mm;margin:0 auto 10mm auto;page-break-after:always;}';
    html += '.doc-page:last-child{page-break-after:auto;}';
    html += '.top-caption{font-size:13px;letter-spacing:.2px;margin:1mm 0 6mm 0;}';
    html += '.form-box{border:1.7px solid #111;padding:6mm 5mm 4mm 5mm;min-height:262mm;position:relative;}';
    html += '.form-head{position:relative;height:24mm;border-bottom:1.6px solid #111;padding-bottom:2mm;margin-bottom:3.2mm;}';
    html += '.logo-box{display:flex;align-items:center;justify-content:center;overflow:visible;}';
    html += '.logo-left{position:absolute;left:0;top:2mm;width:22mm;height:20mm;}';
    html += '.logo-right{position:absolute;right:0;top:2mm;width:30mm;height:20mm;justify-content:center;padding-left:0;padding-right:0;}';
    html += '.logo-box img{display:block;object-fit:contain;}';
    html += '.logo-ppa-img{width:20mm;height:20mm;max-width:20mm;max-height:20mm;}';
    html += '.logo-gacoan-img{width:26mm;height:18mm;max-width:26mm;max-height:18mm;object-fit:contain;}';
    html += '.title-cell{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 78mm);text-align:center;overflow:visible;}';
    html += '.main-title{font-size:20px;line-height:1.05;font-weight:900;letter-spacing:.1px;white-space:nowrap;border-bottom:2px solid #111;display:inline-block;max-width:100%;padding-bottom:1px;text-align:center;overflow:visible;}';
    html += '.meta-wrap{display:grid;grid-template-columns:1fr 1.05fr;gap:4mm;margin-bottom:1.4mm;}';
    html += '.meta-line{display:grid;grid-template-columns:25mm 3mm 1fr;align-items:center;min-height:4mm;}';
    html += '.meta-label{font-size:6.8px;font-weight:700;}';
    html += '.colon{text-align:center;font-weight:700;}';
    html += '.meta-value{font-size:7.4px;font-weight:700;}';
    html += '.area-line .meta-label{background:#facc15;padding:1px 4px;display:inline-block;width:14mm;}';
    html += '.po-note{font-size:7px;line-height:1.25;margin-top:1mm;}';
    html += '.pick-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:6.6px;}';
    html += '.pick-table th,.pick-table td{border:1px solid #111;padding:1.15mm 1mm;vertical-align:middle;height:5.3mm;overflow:hidden;}';
    html += '.pick-table th{background:#000!important;color:#fff!important;text-align:center;font-weight:700;font-size:6.4px;line-height:1.05;}';
    html += '.pick-table td{line-height:1.05;}';
    html += '.center{text-align:center;} .right{text-align:right;} .bold{font-weight:700;}';
    html += '.name-cell{font-weight:700;}';
    html += '.small-cell{font-size:5.8px;line-height:1.05;}';
    html += '.black-band{height:4.2mm;background:#000;margin-top:0;}';
    html += '.sign-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12mm;margin-top:3.5mm;text-align:center;font-size:6.5px;font-weight:700;}';
    html += '.sign-space{height:14mm;}';
    html += '.dot-line{border-bottom:1px dotted #111;height:1px;width:44mm;margin:0 auto;}';
    html += '.page-foot{position:absolute;left:5mm;right:5mm;bottom:2mm;font-size:5.9px;text-align:right;color:#333;}';
    html += '@media print{body{background:#fff;} .no-print{display:none!important;} .doc-page{margin:0 auto;page-break-after:always;} .doc-page:last-child{page-break-after:auto;} body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}';
    html += '</style></head><body>';

    html += '<div class="no-print"><button class="print-btn" onclick="window.print()">Print</button></div>';

    pages.forEach(function(pageRows, pageIndex) {
      html += '<section class="doc-page">';
      html += '<div class="top-caption">STOCK CONTROL FG CP3</div>';
      html += '<div class="form-box">';
      html += '<div class="form-head">';
      html += '<div class="logo-box logo-left"><img class="logo-ppa-img" src="' + logoPpaSrc + '" alt="PT Pesta Pora Abadi"></div>';
      html += '<div class="title-cell"><div class="main-title">FORM BUKTI BARANG MASUK / KELUAR</div></div>';
      html += '<div class="logo-box logo-right"><img class="logo-gacoan-img" src="' + logoGacoanSrc + '" alt="Mie Gacoan"></div>';
      html += '</div>';

      html += '<div class="meta-wrap">';
      html += '<div>';
      html += makeLine('Type Transaksi', 'OUTBOUND', false);
      html += makeLine('Tgl Transaksi', data.tanggalMuat || '', false);
      html += makeLine('Shift', data.shift || '', false);
      html += makeLine('Area', 'WAREHOUSE FINISH GOOD FROZEN', true);
      html += '</div>';
      html += '<div>';
      html += makeLine('Nomor PO', data.nomorPO || '', false);
      html += makeLine('Tujuan', pickText((data.kodeResto || '') + (data.namaResto ? ' - ' + data.namaResto : ''), ''), false);
      html += makeLine('Surat Jalan', data.nomorSuratJalan || '', false);
      html += makeLine('Nopol / Sopir', pickText((data.nopol || '') + (data.namaSopir ? ' / ' + data.namaSopir : ''), ''), false);
      html += '<div class="po-note">Urutan cetak: nomor rak kemudian FEFO. Total Qty Ambil: <b>' + formatNumber(totalQty) + '</b></div>';
      html += '</div>';
      html += '</div>';

      html += '<table class="pick-table"><colgroup>';
      html += '<col style="width:5%"><col style="width:9%"><col style="width:23%"><col style="width:6%"><col style="width:7%"><col style="width:15%"><col style="width:10%"><col style="width:6%"><col style="width:9%"><col style="width:10%">';
      html += '</colgroup><thead><tr>';
      html += '<th>No.</th><th>Kode Barang</th><th>Nama Barang</th><th>Qty Pack</th><th>Qty Carton</th><th>Lokasi</th><th>Tanggal Produksi</th><th>Jam</th><th>Nomor BASTB</th><th>Catatan</th>';
      html += '</tr></thead><tbody>';

      for (var i = 0; i < rowsPerPage; i++) {
        var r = pageRows[i] || null;
        var globalNo = pageIndex * rowsPerPage + i + 1;
        html += '<tr>';
        html += '<td class="center">' + globalNo + '</td>';
        html += '<td class="small-cell">' + escapeHtml(r ? getKodeBarang(r) : '') + '</td>';
        html += '<td class="name-cell">' + escapeHtml(r ? (r.namaBarang || '') : '') + '</td>';
        html += '<td class="right">' + escapeHtml(r && String(r.satuan || '').toUpperCase().indexOf('PACK') >= 0 ? formatNumber(r.qtyPick || 0) : '') + '</td>';
        html += '<td class="right bold">' + escapeHtml(r ? formatNumber(r.qtyPick || 0) : '') + '</td>';
        html += '<td class="bold">' + escapeHtml(r ? (r.lokasiRak || '') : '') + '</td>';
        html += '<td class="center">' + escapeHtml(r ? (r.tanggalProduksi || '') : '') + '</td>';
        html += '<td class="center"></td>';
        html += '<td class="small-cell">' + escapeHtml(r ? (r.nomorBSTB || '') : '') + '</td>';
        html += '<td class="small-cell">' + escapeHtml(r ? getCatatanRow(r) : '') + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table>';
      html += '<div class="black-band"></div>';
      html += '<div class="sign-row">';
      html += '<div><div>TEAM LEADER</div><div class="sign-space"></div><div class="dot-line"></div></div>';
      html += '<div><div>ADMIN OFFICE</div><div class="sign-space"></div><div class="dot-line"></div></div>';
      html += '<div><div>SPV WAREHOUSE</div><div class="sign-space"></div><div class="dot-line"></div></div>';
      html += '</div>';
      html += '<div class="page-foot">Halaman ' + (pageIndex + 1) + ' dari ' + pages.length + '</div>';
      html += '</div></section>';
    });

    html += '</body></html>';

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(function() {
      try { printWin.print(); } catch (e) {}
    }, 500);
  }

  function loadBarangKeluarEditList() {
    var wrap = byId('edit_out_result');
    if (!wrap) return;
    wrap.innerHTML = '<div class="empty">Memuat data barang keluar...</div>';
    google.script.run.withSuccessHandler(function(rows) {
      renderBarangKeluarEditList(rows || []);
    }).withFailureHandler(function(err) {
      wrap.innerHTML = '<div class="empty">' + escapeHtml(err.message || err) + '</div>';
    }).getBarangKeluarEditList({
      startDate: val('edit_out_startDate'),
      endDate: val('edit_out_endDate'),
      keyword: val('edit_out_keyword'),
      auth: getAuthPayload()
    });
  }

  function renderBarangKeluarEditList(rows) {
    var wrap = byId('edit_out_result');
    if (!wrap) return;
    if (!rows.length) {
      wrap.innerHTML = '<div class="empty">Tidak ada barang keluar sesuai filter.</div>';
      return;
    }
    var html = '<div class="form-table-wrap"><table class="form-table"><thead><tr>' +
      '<th>Tanggal / SJ</th><th>Tujuan</th><th>Barang</th><th>Lokasi / Batch</th><th>Qty Lama</th><th>Qty Baru</th><th>Alasan Edit</th><th>Aksi</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var id = r.rowNumber;
      html += '<tr data-rowid="' + escapeAttr(id) + '">' +
        '<td>' + escapeHtml(r.tanggalDimuat) + '<br><span class="small">SJ: ' + escapeHtml(r.nomorSuratJalan || '-') + '<br>OTDR: ' + escapeHtml(r.idOtdr || '-') + '</span></td>' +
        '<td>' + escapeHtml((r.kodeResto || '-') + ' - ' + (r.namaResto || '-')) + '</td>' +
        '<td><b>' + escapeHtml(r.namaBarang) + '</b><br><span class="small">ID: ' + escapeHtml(r.idStock || '-') + '</span></td>' +
        '<td>' + escapeHtml(r.lokasiRak || '-') + '<br><span class="small">Batch: ' + escapeHtml(r.nomorBatch || '-') + '<br>Exp: ' + escapeHtml(r.tanggalExpired || '-') + '</span></td>' +
        '<td><b>' + formatNumber(r.qtyKeluar) + '</b> ' + escapeHtml(r.satuan || '') + '</td>' +
        '<td><input type="text" id="edit_qty_' + id + '" value="' + escapeAttr(r.qtyKeluar) + '" inputmode="numeric" pattern="[0-9]*" onkeydown="return preventQtyDecimal(event)" oninput="normalizeQtyInput(this)"></td>' +
        '<td><textarea id="edit_reason_' + id + '" placeholder="Wajib: contoh barang kurang/lebih saat cek loading"></textarea></td>' +
        '<td><button class="warning mini" type="button" onclick="saveBarangKeluarEdit(' + id + ')">Simpan Edit</button></td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  function saveBarangKeluarEdit(rowNumber) {
    var qty = val('edit_qty_' + rowNumber);
    var reason = val('edit_reason_' + rowNumber);
    if (!qty) { showMsg('msg_edit_out', 'Qty baru wajib diisi.', false); return; }
    if (!reason) { showMsg('msg_edit_out', 'Alasan edit wajib diisi.', false); return; }
    if (!confirm('Simpan edit barang keluar row ' + rowNumber + '? Stock dan OTDR akan dikoreksi otomatis.')) return;

    showMsg('msg_edit_out', 'Menyimpan edit dan mengoreksi stock...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_edit_out', res.message, true);
      loadBarangKeluarEditList();
      loadMasterData();
    }).withFailureHandler(function(err) {
      showMsg('msg_edit_out', err.message || err, false);
    }).updateBarangKeluarMismatch({
      rowNumber: rowNumber,
      qtyBaru: qty,
      alasan: reason,
      auth: getAuthPayload()
    });
  }

  function addOutputLine() {
    outputLineCounter++;
    var id = outputLineCounter;
    var wrap = document.createElement('div');
    wrap.className = 'line-card output-line';
    wrap.setAttribute('data-id', id);
    wrap.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;"><b>Output Barang #' + id + '</b><button type="button" class="danger" style="width:auto;padding:6px 10px;margin:0;" onclick="removeOutputLine(' + id + ')">Hapus</button></div>' +
      '<label>Nama Barang</label><select id="out_line_barang_' + id + '" onchange="applyOutputBarangDefault(' + id + ')"></select>' +
      '<label>Qty Keluar</label><input type="text" id="out_line_qty_' + id + '" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Contoh: 100" onkeydown="return preventQtyDecimal(event)" oninput="normalizeQtyInput(this)" onpaste="var input=this; setTimeout(function(){ normalizeQtyInput(input); }, 0)">' +
      '<label>Satuan</label><select id="out_line_satuan_' + id + '" onchange="refreshOutputStockOptions(' + id + ')"><option value="Carton">Carton</option><option value="Pack">Pack</option><option value="Pcs">Pcs</option><option value="Kg">Kg</option></select>' +
      '<label>Lokasi Rak</label><div class="search-select-box"><input type="search" id="out_line_lokasi_search_' + id + '" placeholder="Cari rak / batch / tanggal produksi..." autocomplete="off" oninput="renderOutputLineLocationOptions(' + id + ')" onkeydown="handleOutputLocationSearchKey(event, ' + id + ')"><select id="out_line_lokasi_' + id + '" onchange="refreshOutputStockOptions(' + id + ')"></select></div>' +
      '<label>Pilih Batch / Lot</label><select id="out_line_batch_' + id + '" onchange="syncOutputBatchStock(' + id + ')"></select><div class="small">Pilih batch tertentu jika tidak ingin FEFO otomatis. Opsi batch mengikuti barang, satuan, dan rak yang dipilih.</div>' +
      '<label>ID Stock / Lot</label><div class="search-select-box"><input type="search" id="out_line_stock_search_' + id + '" placeholder="Cari ID stock / batch / rak / tanggal produksi / expired..." autocomplete="off" oninput="refreshOutputStockOptions(' + id + ')"><select id="out_line_stock_' + id + '" onchange="syncOutputStockBatch(' + id + ')"></select></div><div class="small">Kosongkan agar sistem FEFO otomatis. Pencarian bisa memakai batch, rak, atau tanggal produksi.</div>' +
      '<label>Keterangan Item</label><textarea id="out_line_keterangan_' + id + '"></textarea>';
    byId('output_lines').appendChild(wrap);
    refreshOutputLineSelects(id);
  }

  function removeOutputLine(id) {
    var el = document.querySelector('.output-line[data-id="' + id + '"]');
    if (el) el.remove();
  }

  function refreshAllOutputLineSelects() {
    Array.prototype.forEach.call(document.querySelectorAll('.output-line'), function(el) {
      refreshOutputLineSelects(el.getAttribute('data-id'));
    });
  }

  function refreshOutputLineSelects(id) {
    fillSelect('out_line_barang_' + id, master.barang.map(function(x) { return { value:x.nama, label:x.nama }; }), true, '-- Pilih Barang --');
    renderOutputLineLocationOptions(id);
    refreshOutputStockOptions(id);
  }

  function renderOutputLineLocationOptions(id) {
    var select = byId('out_line_lokasi_' + id);
    if (!select) return;
    var current = select.value;
    var q = normalizeSearchTextClient(val('out_line_lokasi_search_' + id));
    var rows = [];
    var seen = {};

    function pushRack(rak, stock) {
      if (!rak) return;
      var key = String(rak).toUpperCase().trim();
      if (seen[key]) return;
      seen[key] = true;
      var label = rak;
      if (stock) {
        label += ' | ' + (stock.namaBarang || '-') + ' | Batch: ' + (stock.nomorBatch || '-') + ' | Prod: ' + (stock.tanggalProduksi || '-') + ' | Exp: ' + (stock.tanggalExpired || '-') + ' | Stock: ' + (stock.stockOnhand || 0) + ' ' + (stock.satuan || '');
      }
      rows.push({ value: rak, label: label });
    }

    if (q) {
      (master.stock || []).forEach(function(s) {
        if (Number(s.stockOnhand || 0) <= 0) return;
        var haystack = normalizeSearchTextClient([s.idStock, s.namaBarang, s.lokasiRak, s.tanggalProduksi, s.tanggalExpired, s.status, s.nomorBSTB, s.nomorBatch, s.satuan].join(' '));
        if (haystack.indexOf(q) !== -1) pushRack(s.lokasiRak, s);
      });
      (master.rak || []).forEach(function(rak) {
        if (normalizeSearchTextClient(rak).indexOf(q) !== -1) pushRack(rak, null);
      });
    } else {
      (master.rak || []).forEach(function(rak) { pushRack(rak, null); });
    }

    var html = '<option value="">Semua / Otomatis</option>';
    rows.slice(0, 120).forEach(function(row) {
      html += '<option value="' + escapeHtml(row.value) + '">' + escapeHtml(row.label) + '</option>';
    });
    if (!rows.length) html += '<option value="" disabled>Tidak ada rak/tanggal produksi yang cocok</option>';
    if (rows.length > 120) html += '<option value="" disabled>Menampilkan 120 dari ' + rows.length + ' rak. Persempit pencarian.</option>';
    select.innerHTML = html;
    if (current && rows.some(function(r) { return r.value === current; })) select.value = current;
    refreshOutputStockOptions(id);
  }

  function applyOutputBarangDefault(id) {
    var nama = val('out_line_barang_' + id);
    var item = master.barang.find(function(x) { return x.nama === nama; });
    if (item && item.satuan) byId('out_line_satuan_' + id).value = item.satuan;
    renderOutputLineLocationOptions(id);
    refreshOutputStockOptions(id);
  }

  function refreshOutputStockOptions(id) {
    var nama = val('out_line_barang_' + id);
    var satuan = val('out_line_satuan_' + id);
    var lokasi = val('out_line_lokasi_' + id);
    var q = normalizeSearchTextClient(val('out_line_stock_search_' + id));
    var arr = (master.stock || []).filter(function(s) {
      var ok = Number(s.stockOnhand || 0) > 0;
      if (nama) ok = ok && s.namaBarang === nama;
      if (satuan) ok = ok && s.satuan === satuan;
      if (lokasi) ok = ok && s.lokasiRak === lokasi;
      if (q) {
        var haystack = normalizeSearchTextClient([s.idStock, s.namaBarang, s.lokasiRak, s.tanggalProduksi, s.tanggalExpired, s.status, s.nomorBSTB, s.nomorBatch, s.satuan, s.namaUserInputTerakhir].join(' '));
        ok = ok && haystack.indexOf(q) !== -1;
      }
      return ok;
    });
    var html = '<option value="">-- Otomatis FEFO --</option>';
    var batchHtml = '<option value="">-- Otomatis FEFO / pilih batch --</option>';
    arr.forEach(function(s) {
      var label = s.idStock + ' | Batch: ' + (s.nomorBatch || '-') + ' | Prod: ' + (s.tanggalProduksi || '-') + ' | Exp: ' + (s.tanggalExpired || '-') + ' | Rak: ' + (s.lokasiRak || '-') + ' | Stock: ' + s.stockOnhand + ' ' + s.satuan;
      var batchLabel = 'Batch: ' + (s.nomorBatch || '-') + ' | Rak: ' + (s.lokasiRak || '-') + ' | Exp: ' + (s.tanggalExpired || '-') + ' | Stock: ' + s.stockOnhand + ' ' + s.satuan + ' | ID: ' + s.idStock;
      html += '<option value="' + escapeHtml(s.idStock) + '">' + escapeHtml(label) + '</option>';
      batchHtml += '<option value="' + escapeHtml(s.idStock) + '">' + escapeHtml(batchLabel) + '</option>';
    });
    if (!arr.length) {
      html += '<option value="" disabled>Tidak ada lot yang cocok dengan filter/pencarian</option>';
      batchHtml += '<option value="" disabled>Tidak ada batch/lot yang cocok</option>';
    }
    var select = byId('out_line_stock_' + id);
    var batchSelect = byId('out_line_batch_' + id);
    var currentStock = select ? select.value : '';
    var currentBatch = batchSelect ? batchSelect.value : '';
    if (select) select.innerHTML = html;
    if (batchSelect) batchSelect.innerHTML = batchHtml;

    function hasId(stockId) { return arr.some(function(s) { return s.idStock === stockId; }); }
    if (currentStock && hasId(currentStock)) {
      if (select) select.value = currentStock;
      if (batchSelect) batchSelect.value = currentStock;
    } else if (currentBatch && hasId(currentBatch)) {
      if (batchSelect) batchSelect.value = currentBatch;
      if (select) select.value = currentBatch;
    }
  }

  function applySelectedOutputStockToLine(id, stockId) {
    var item = (master.stock || []).find(function(s) { return s.idStock === stockId; });
    if (!item) return;
    if (byId('out_line_barang_' + id) && item.namaBarang) byId('out_line_barang_' + id).value = item.namaBarang;
    if (byId('out_line_satuan_' + id) && item.satuan) byId('out_line_satuan_' + id).value = item.satuan;
    if (byId('out_line_lokasi_' + id) && item.lokasiRak) {
      var locSelect = byId('out_line_lokasi_' + id);
      var exists = Array.prototype.some.call(locSelect.options, function(opt) { return opt.value === item.lokasiRak; });
      if (!exists) {
        var opt = document.createElement('option');
        opt.value = item.lokasiRak;
        opt.textContent = item.lokasiRak + ' | Batch: ' + (item.nomorBatch || '-') + ' | Stock: ' + (item.stockOnhand || 0) + ' ' + (item.satuan || '');
        locSelect.appendChild(opt);
      }
      locSelect.value = item.lokasiRak;
    }
  }

  function syncOutputBatchStock(id) {
    var batchSelect = byId('out_line_batch_' + id);
    var stockSelect = byId('out_line_stock_' + id);
    if (!batchSelect || !stockSelect) return;
    stockSelect.value = batchSelect.value || '';
    if (batchSelect.value) applySelectedOutputStockToLine(id, batchSelect.value);
  }

  function syncOutputStockBatch(id) {
    var batchSelect = byId('out_line_batch_' + id);
    var stockSelect = byId('out_line_stock_' + id);
    if (!batchSelect || !stockSelect) return;
    batchSelect.value = stockSelect.value || '';
    if (stockSelect.value) applySelectedOutputStockToLine(id, stockSelect.value);
  }

  function collectOutputLines() {
    var lines = [];
    Array.prototype.forEach.call(document.querySelectorAll('.output-line'), function(el) {
      var id = el.getAttribute('data-id');
      var nama = val('out_line_barang_' + id);
      var qty = val('out_line_qty_' + id);
      if (!nama && !qty) return;
      var idStock = val('out_line_stock_' + id) || val('out_line_batch_' + id);
      var selectedStock = (master.stock || []).find(function(s) { return s.idStock === idStock; }) || null;
      lines.push({
        namaBarang: selectedStock && selectedStock.namaBarang ? selectedStock.namaBarang : nama,
        qtyKeluar: qty,
        satuan: selectedStock && selectedStock.satuan ? selectedStock.satuan : val('out_line_satuan_' + id),
        lokasiRak: selectedStock && selectedStock.lokasiRak ? selectedStock.lokasiRak : val('out_line_lokasi_' + id),
        idStock: idStock,
        nomorBatch: selectedStock ? selectedStock.nomorBatch : '',
        keterangan: val('out_line_keterangan_' + id)
      });
    });
    return lines;
  }

  function sendBarangMasukPayload(data, tanggalBSTBText) {
    showMsg('msg_masuk', 'Mengecek notice koordinator dan menyimpan...', true);
    google.script.run.withSuccessHandler(function(res) {
      if (res && res.needConfirm) {
        var lanjut = confirm((res.message || 'Ada notice koordinator.') + '\\n\\nKlik OK untuk tetap menyimpan, atau Cancel untuk membatalkan dan cek data terlebih dahulu.');
        if (!lanjut) {
          showMsg('msg_masuk', 'Submit barang masuk dibatalkan karena ada notice koordinator. Silakan cek BARANG_MASUK / STOCK_ONHAND agar tidak double input.', false);
          return;
        }
        data.confirmNotice = true;
        sendBarangMasukPayload(data, tanggalBSTBText);
        return;
      }

      var batchSummary = summarizeInboundBatchesClient(data.batches || []);
      var batchText = batchSummary.lines.join('\\n');
      showMsg('msg_masuk', (res.message || 'Barang masuk berhasil disimpan.') + ' Tanggal BSTB: ' + tanggalBSTBText + ', User: ' + (currentUser ? currentUser.namaUser : '-') + ', Nama: ' + data.namaBarang + ', Total Qty: ' + batchSummary.totalQty + ' ' + data.satuan + ', Waktu CS: ' + formatMinuteSecondText(data.waktuCSMenit), true);
      alert(
        'Barang Masuk Berhasil Disimpan!\\n\\n' +
        'Tanggal BSTB : ' + tanggalBSTBText + '\\n' +
        'Nomor BSTB   : ' + (data.nomorBSTB || '-') + '\\n' +
        'User Input   : ' + (currentUser ? currentUser.namaUser : '-') + '\\n' +
        'Nama Barang  : ' + data.namaBarang + '\\n' +
        'Total Batch  : ' + (data.batches ? data.batches.length : 0) + '\\n' +
        'Total Qty    : ' + batchSummary.totalQty + ' ' + data.satuan + '\\n' +
        'Waktu CS     : ' + formatMinuteSecondText(data.waktuCSMenit) + '\\n\\n' +
        'Detail Batch:\\n' + batchText
      );
      clearInboundBatchInputs();
      loadMasterData();
    }).withFailureHandler(function(err) { showMsg('msg_masuk', err.message || err, false); }).submitBarangMasuk(data);
  }

  function submitMasuk() {
    var batches = collectInboundBatches();
    var batchError = validateInboundBatchesClient(batches);
    if (batchError) {
      alert(batchError);
      return;
    }

    var batchSummary = summarizeInboundBatchesClient(batches);
    var data = {
      tanggalBSTB: val('in_tanggalBSTB'),
      tanggalProduksi: val('in_tanggalProduksi'),
      expiredBulan: val('in_expiredBulan'),
      waktuCSMenit: val('in_waktuCSMenit'),
      namaBarang: val('in_namaBarang'),
      qty: String(batchSummary.totalQty),
      nomorBatch: batches.map(function(x) { return x.nomorBatch || ''; }).filter(String).join(', '),
      satuan: val('in_satuan'),
      status: val('in_status'),
      shiftIn: val('in_shiftIn'),
      nomorBSTB: val('in_nomorBSTB'),
      lokasiRak: batches.map(function(x) { return x.lokasiRak || ''; }).filter(String).join(', '),
      nomorITKirim: val('in_nomorITKirim'),
      keterangan: val('in_keterangan'),
      jamInDisplay: val('in_jamIn'),
      batches: batches,
      auth: getAuthPayload()
    };

    if (!data.tanggalBSTB) { alert('Tanggal BSTB wajib diisi.'); return; }
    if (!data.tanggalProduksi) { alert('Tanggal produksi wajib diisi.'); return; }
    if (!data.namaBarang) { alert('Nama barang wajib dipilih sebelum submit barang masuk.'); return; }
    if (!data.satuan) { alert('Satuan wajib diisi.'); return; }
    if (!data.status) { alert('Status barang wajib dipilih.'); return; }
    if (!data.shiftIn) { alert('Koordinator / Shift In wajib dipilih.'); return; }
    if (!data.nomorBSTB) { alert('Nomor BSTB wajib diisi.'); return; }
    if (data.waktuCSMenit && !isMinuteSecondDurationString(data.waktuCSMenit)) { alert('Waktu Masuk CS harus format menit:detik dan lebih dari 0. Contoh: 03:30, 15:00, atau 00:45'); return; }

    var tanggalBSTBText = formatTanggalAlert(data.tanggalBSTB);
    var rakInfoLines = [];
    batches.forEach(function(row, idx) {
      var rakLastOut = getRackLastOutClient(row.lokasiRak);
      if (rakLastOut) {
        rakInfoLines.push('Batch ' + (idx + 1) + ' rak ' + row.lokasiRak + ': terakhir keluar ' + (rakLastOut.tanggalKeluar || '-') + ' | ' + (rakLastOut.namaBarang || '-') + ' | Qty ' + (rakLastOut.qtyKeluar || 0) + ' ' + (rakLastOut.satuan || '') + ' | SJ ' + (rakLastOut.nomorSuratJalan || '-'));
      }
    });
    var rakInfoText = rakInfoLines.length ? ('\\n\\nInfo Rak:\\n' + rakInfoLines.join('\\n')) : '';

    var alertText =
      'Konfirmasi Barang Masuk:\\n\\n' +
      'Tanggal BSTB : ' + tanggalBSTBText + '\\n' +
      'Nomor BSTB   : ' + (data.nomorBSTB || '-') + '\\n' +
      'User Input   : ' + (currentUser ? currentUser.namaUser : '-') + '\\n' +
      'Nama Barang  : ' + data.namaBarang + '\\n' +
      'Total Batch  : ' + batches.length + '\\n' +
      'Total Qty    : ' + batchSummary.totalQty + ' ' + data.satuan + '\\n\\n' +
      'Detail Batch:\\n' + batchSummary.lines.join('\\n') + '\\n' +
      'Jam In       : ' + (data.jamInDisplay || '-') + '\\n' +
      'Waktu CS     : ' + formatMinuteSecondText(data.waktuCSMenit) + rakInfoText + '\\n\\n' +
      'Apakah data sudah benar?';

    if (!confirm(alertText)) {
      showMsg('msg_masuk', 'Submit barang masuk dibatalkan.', false);
      return;
    }

    sendBarangMasukPayload(data, tanggalBSTBText);
  }

  function sendBarangKeluarPayload(data, resto, tanggalDimuatText, itemLines) {
    showMsg('msg_keluar', 'Mengecek notice koordinator dan menyimpan semua output...', true);
    google.script.run.withSuccessHandler(function(res) {
      if (res && res.needConfirm) {
        var lanjut = confirm((res.message || 'Ada notice koordinator.') + '\\n\\nKlik OK untuk tetap menyimpan, atau Cancel untuk membatalkan dan cek data terlebih dahulu.');
        if (!lanjut) {
          showMsg('msg_keluar', 'Barang keluar dibatalkan karena ada notice koordinator. Silakan cek BARANG_KELUAR / OTDR / STOCK_ONHAND agar tidak double output.', false);
          return;
        }
        data.confirmNotice = true;
        sendBarangKeluarPayload(data, resto, tanggalDimuatText, itemLines);
        return;
      }
      showMsg('msg_keluar', res.message + ' User transaksi: ' + (currentUser ? currentUser.namaUser : '-'), true);
      alert(
        'Barang Keluar Berhasil Disimpan!\\n\\n' +
        'Tujuan Resto  : ' + (resto.kode || '-') + ' - ' + (resto.nama || '-') + '\\n' +
        'Tanggal Dimuat: ' + tanggalDimuatText + '\\n' +
        'Daftar Item:\\n' + itemLines.join('\\n') + '\\n\\n' +
        'ID OTDR: ' + (res.otdrId || '-')
      );
      byId('output_lines').innerHTML = ''; outputLineCounter = 0; addOutputLine();
      byId('out_nomorSuratJalan').value = ''; byId('out_nomorITKirim').value = ''; byId('out_keterangan').value = '';
      loadMasterData();
    }).withFailureHandler(function(err) { showMsg('msg_keluar', (err.message || err) + ' | Tidak ada CRUD barang keluar yang disimpan saat gagal.', false); }).submitBarangKeluarBatch(data);
  }

  function submitKeluarBatch() {
    var data = {
      tglDimuat: val('out_tglDimuat'), restoId: val('out_restoId'), shiftOut: val('out_shiftOut'),
      nomorSuratJalan: val('out_nomorSuratJalan'), nomorITKirim: val('out_nomorITKirim'),
      keterangan: val('out_keterangan'), outputs: collectOutputLines(), auth: getAuthPayload()
    };

    var resto = (master.resto || []).find(function(x) { return x.id === data.restoId; });
    if (!data.tglDimuat) { alert('Tanggal dimuat wajib diisi.'); return; }
    if (!resto) { alert('Kode resto / tujuan resto wajib dipilih.'); return; }
    if (!data.shiftOut) { alert('Shift Out / Koordinator wajib dipilih.'); return; }
    if (!data.nomorSuratJalan) { alert('Nomor Surat Jalan wajib diisi.'); return; }
    if (!data.outputs.length) { alert('Minimal tambah 1 output barang keluar.'); return; }

    var totalQty = 0;
    var itemLines = [];
    for (var i = 0; i < data.outputs.length; i++) {
      var line = data.outputs[i];
      if (!line.namaBarang) { alert('Output baris ' + (i + 1) + ': Nama barang wajib diisi.'); return; }
      if (!isPositiveIntegerString(line.qtyKeluar)) { alert('Output baris ' + (i + 1) + ': Qty keluar harus angka bulat tanpa koma/desimal.'); return; }
      if (!line.satuan) { alert('Output baris ' + (i + 1) + ': Satuan wajib diisi.'); return; }
      totalQty += Number(line.qtyKeluar);
      itemLines.push((i + 1) + '. ' + line.namaBarang + ' - Qty: ' + line.qtyKeluar + ' ' + line.satuan + (line.lokasiRak ? ' | Rak: ' + line.lokasiRak : '') + (line.nomorBatch ? ' | Batch: ' + line.nomorBatch : '') + (line.idStock ? ' | Lot: ' + line.idStock : ' | FEFO otomatis'));
    }

    var tanggalDimuatText = formatTanggalAlert(data.tglDimuat);
    var confirmText =
      'Konfirmasi Simpan Semua Output Barang Keluar:\\n\\n' +
      'Tujuan Resto  : ' + (resto.kode || '-') + ' - ' + (resto.nama || '-') + '\\n' +
      'Tanggal Dimuat: ' + tanggalDimuatText + '\\n' +
      'Nopol / Sopir : ' + (resto.nopol || '-') + ' / ' + (resto.sopir || '-') + '\\n' +
      'Nomor SJ      : ' + (data.nomorSuratJalan || '-') + '\\n' +
      'Nomor IT Kirim: ' + (data.nomorITKirim || '-') + '\\n' +
      'User Input    : ' + (currentUser ? currentUser.namaUser : '-') + '\\n\\n' +
      'Daftar Item Output:\\n' + itemLines.join('\\n') + '\\n\\n' +
      'Total Item: ' + data.outputs.length + '\\n' +
      'Total Qty : ' + totalQty + '\\n\\n' +
      'Apakah data barang keluar sudah benar dan siap disimpan?';

    if (!confirm(confirmText)) {
      showMsg('msg_keluar', 'Simpan semua output dibatalkan.', false);
      return;
    }

    sendBarangKeluarPayload(data, resto, tanggalDimuatText, itemLines);
  }

  function loadOtdrOptions() {
    google.script.run.withSuccessHandler(function(rows) {
      master.otdr = rows;
      var opts = rows.map(function(x) { return { value:x.idOtdr, label:x.label + ' | ' + x.statusOtdr }; });
      fillSelect('otdr_id', opts, true, '-- Pilih OTDR --');
      renderOtdrTable(rows);
    }).withFailureHandler(function(err) { showMsg('msg_otdr', err.message || err, false); }).getOtdrList({ statusNotDoneOnly: false });
  }

  function loadSelectedOtdr() {
    var id = val('otdr_id');
    if (!id) return;
    google.script.run.withSuccessHandler(function(o) {
      byId('otdr_info').innerHTML = '<b>' + escapeHtml(o.kodeResto + ' - ' + o.namaResto) + '</b><br>SJ: ' + escapeHtml(o.nomorSuratJalan) + ' | IT: ' + escapeHtml(o.nomorITKirim) + '<br>Total: ' + escapeHtml(o.totalItem) + ' item / ' + escapeHtml(o.totalQty) + ' qty | Status: ' + escapeHtml(o.statusOtdr) + '<br>User Create: ' + escapeHtml(o.namaUserCreate || '-') + ' | User Update: ' + escapeHtml(o.namaUserUpdate || '-');
      byId('otdr_nopol').value = o.nopol || '';
      byId('otdr_waSopir').value = o.waSopir || '';
      byId('otdr_namaSopir').value = o.namaSopir || '';
      byId('otdr_startMuat').value = o.startMuat || '';
      byId('otdr_selesaiMuat').value = o.selesaiMuat || '';
      byId('otdr_namaMuat').value = o.namaMuat || '';
      byId('otdr_catatan').value = o.catatan || '';
    }).withFailureHandler(function(err) { showMsg('msg_otdr', err.message || err, false); }).getOtdrById(id);
  }

  function submitOtdr() {
    var data = {
      idOtdr: val('otdr_id'), nopol: val('otdr_nopol'), waSopir: val('otdr_waSopir'), namaSopir: val('otdr_namaSopir'),
      startMuat: val('otdr_startMuat'), selesaiMuat: val('otdr_selesaiMuat'), namaMuat: val('otdr_namaMuat'), catatan: val('otdr_catatan'), auth: getAuthPayload()
    };
    showMsg('msg_otdr', 'Menyimpan OTDR...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_otdr', res.message, true);
      loadOtdrOptions();
    }).withFailureHandler(function(err) { showMsg('msg_otdr', err.message || err, false); }).updateOtdr(data);
  }

  function renderOtdrTable(rows) {
    var div = byId('otdr_table');
    if (!rows || !rows.length) { div.innerHTML = '<div class="empty">Belum ada OTDR.</div>'; return; }
    var html = '<table><thead><tr><th>OTDR</th><th>Resto</th><th>Driver / WA</th><th>Muat</th><th>Status & Evidence</th></tr></thead><tbody>';
    rows.slice(0, 100).forEach(function(o) {
      var done = isOtdrDoneClient(o.statusOtdr);
      var cls = done ? 'success' : (String(o.statusOtdr || '').indexOf('TIDAK') >= 0 ? 'danger' : 'warning');
      var evidence = o.linkBuktiFoto ? '<a class="proof-link" target="_blank" href="' + escapeAttr(o.linkBuktiFoto) + '">👁️ Lihat Bukti</a>' : '<span class="small">Belum ada bukti terima</span>';
      html += '<tr><td><b>' + escapeHtml(o.idOtdr) + '</b><br><span class="small">' + escapeHtml(o.tanggalDimuat) + '<br>SJ: ' + escapeHtml(o.nomorSuratJalan) + '<br>User: ' + escapeHtml(o.namaUserUpdate || o.namaUserCreate || '-') + '</span></td>' +
        '<td>' + escapeHtml(o.kodeResto) + '<br><span class="small">' + escapeHtml(o.namaResto) + '</span></td>' +
        '<td>' + escapeHtml(o.nopol) + '<br><span class="small">' + escapeHtml(o.namaSopir) + '<br>' + escapeHtml(o.waSopir) + '</span><div class="action-stack"><button class="success mini" onclick="openDriverWa(\\'' + escapeJs(o.idOtdr) + '\\')">📲 WA Sopir</button><button class="secondary mini" onclick="copyDriverDashboardLink(\\'' + escapeJs(o.idOtdr) + '\\')">🔗 Copy Link</button></div></td>' +
        '<td><span class="small">Start: ' + escapeHtml(o.startMuat) + '<br>Selesai: ' + escapeHtml(o.selesaiMuat) + '<br>Team: ' + escapeHtml(o.namaMuat) + '</span></td>' +
        '<td><span class="badge ' + cls + '">' + escapeHtml(o.statusOtdr || '-') + '</span><br>' + evidence + '<div class="small">Terima: ' + escapeHtml(o.statusTerimaSopir || '-') + '<br>Penerima: ' + escapeHtml(o.namaPenerima || '-') + '<br>Checker: ' + escapeHtml(o.namaChecker || '-') + '</div></td></tr>';
    });
    html += '</tbody></table>';
    div.innerHTML = html;
  }

  function openDriverWa(idOtdr) {
    showMsg('msg_otdr', 'Menyiapkan link WhatsApp sopir...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_otdr', 'Link WA siap. Jika tab WA tidak terbuka, cek popup blocker browser.', true);
      window.open(res.waUrl, '_blank');
    }).withFailureHandler(function(err) {
      showMsg('msg_otdr', err.message || err, false);
    }).getOtdrWaLink({ idOtdr: idOtdr, auth: getAuthPayload() });
  }

  function copyDriverDashboardLink(idOtdr) {
    google.script.run.withSuccessHandler(function(o) {
      if (!o.driverDashboardUrl) {
        showMsg('msg_otdr', 'Link dashboard belum tersedia. Deploy script sebagai Web App dahulu.', false);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(o.driverDashboardUrl).then(function() {
          showMsg('msg_otdr', 'Link dashboard sopir berhasil disalin.', true);
        }, function() { prompt('Copy link dashboard sopir:', o.driverDashboardUrl); });
      } else {
        prompt('Copy link dashboard sopir:', o.driverDashboardUrl);
      }
    }).withFailureHandler(function(err) { showMsg('msg_otdr', err.message || err, false); }).getOtdrById(idOtdr);
  }

  function submitLokasi() {
    var data = {
      idStock: val('loc_idStock'),
      lokasiBaru: val('loc_lokasiBaru'),
      statusBaru: val('loc_statusBaru'),
      pic: val('loc_pic'),
      keterangan: val('loc_keterangan'),
      auth: getAuthPayload()
    };

    if (data.statusBaru && currentUser && !currentUser.access.supervisor && currentUser.access.lokasi) {
      var statusKey = String(data.statusBaru || '').toUpperCase().trim();
      if (statusKey !== 'GOOD' && statusKey !== 'HOLD') {
        showMsg('msg_lokasi', 'User Inventory hanya boleh update status GOOD atau HOLD.', false);
        return;
      }
    }

    showMsg('msg_lokasi', 'Menyimpan...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_lokasi', res.message + ' User update: ' + (currentUser ? currentUser.namaUser : '-'), true);
      byId('loc_statusBaru').value = '';
      byId('loc_lokasiBaru').value = '';
      if (byId('loc_lokasiBaru_search')) byId('loc_lokasiBaru_search').value = '';
      loadMasterData();
    }).withFailureHandler(function(err) {
      showMsg('msg_lokasi', err.message || err, false);
    }).updateLokasiStock(data);
  }

  function applySelectedStockToLokasi() {
    var idStock = val('loc_idStock');
    var item = (master.stock || []).find(function(s) { return s.idStock === idStock; });
    if (!item) {
      if (byId('loc_info')) byId('loc_info').innerHTML = '';
      return;
    }
    if (byId('loc_info')) {
      byId('loc_info').innerHTML = 'Batch: <b>' + escapeHtml(item.nomorBatch || '-') + '</b> | ID Lot: <b>' + escapeHtml(item.idStock || '-') + '</b> | Status saat ini: <b>' + escapeHtml(item.status) + '</b> | Lokasi saat ini: <b>' + escapeHtml(item.lokasiRak) + '</b> | Stock: <b>' + escapeHtml(item.stockOnhand) + ' ' + escapeHtml(item.satuan) + '</b>';
    }
  }

  function refreshLocationStockOptions() {
    var q = normalizeSearchTextClient(val('loc_stockSearch'));
    var arr = (master.stock || []).filter(function(s) {
      var ok = Number(s.stockOnhand || 0) > 0;
      if (q) {
        var haystack = normalizeSearchTextClient([s.idStock, s.namaBarang, s.nomorBatch, s.status, s.lokasiRak, s.tanggalProduksi, s.tanggalExpired, s.nomorBSTB, s.satuan, s.namaUserInputTerakhir].join(' '));
        ok = ok && haystack.indexOf(q) !== -1;
      }
      return ok;
    });
    var current = val('loc_idStock');
    var html = '<option value="">-- Pilih ID Stock --</option>';
    arr.slice(0, 150).forEach(function(s) {
      var label = s.idStock + ' | Batch: ' + (s.nomorBatch || '-') + ' | ' + s.namaBarang + ' | Prod: ' + (s.tanggalProduksi || '-') + ' | Exp: ' + (s.tanggalExpired || '-') + ' | Status: ' + s.status + ' | Rak: ' + s.lokasiRak + ' | Stock: ' + s.stockOnhand + ' ' + s.satuan;
      html += '<option value="' + escapeHtml(s.idStock) + '">' + escapeHtml(label) + '</option>';
    });
    if (!arr.length) html += '<option value="" disabled>Tidak ada stock yang cocok dengan rak/tanggal produksi tersebut</option>';
    if (arr.length > 150) html += '<option value="" disabled>Menampilkan 150 dari ' + arr.length + ' hasil. Persempit pencarian.</option>';
    byId('loc_idStock').innerHTML = html;
    if (current && arr.some(function(s) { return s.idStock === current; })) byId('loc_idStock').value = current;
    applySelectedStockToLokasi();
  }


  function renderStockOpnameRackOptions() {
    var select = byId('op_lokasiRak');
    if (!select) return;
    var current = select.value;
    var q = normalizeSearchTextClient(val('op_lokasiRak_search'));
    var rows = [];
    var seen = {};
    function pushRack(rak, stock) {
      if (!rak) return;
      var key = String(rak).toUpperCase().trim();
      if (seen[key]) return;
      seen[key] = true;
      var label = rak;
      if (stock) label += ' | ' + (stock.namaBarang || '-') + ' | Prod: ' + (stock.tanggalProduksi || '-') + ' | Exp: ' + (stock.tanggalExpired || '-') + ' | Stock: ' + (stock.stockOnhand || 0) + ' ' + (stock.satuan || '');
      rows.push({ value: rak, label: label });
    }
    if (q) {
      (master.stock || []).forEach(function(s) {
        if (Number(s.stockOnhand || 0) <= 0) return;
        var haystack = normalizeSearchTextClient([s.idStock, s.namaBarang, s.lokasiRak, s.tanggalProduksi, s.tanggalExpired, s.status, s.nomorBSTB, s.satuan].join(' '));
        if (haystack.indexOf(q) !== -1) pushRack(s.lokasiRak, s);
      });
      (master.rak || []).forEach(function(rak) {
        if (normalizeSearchTextClient(rak).indexOf(q) !== -1) pushRack(rak, null);
      });
    } else {
      (master.rak || []).forEach(function(rak) { pushRack(rak, null); });
    }
    var html = '<option value="">Semua</option>';
    rows.slice(0, 150).forEach(function(row) {
      html += '<option value="' + escapeHtml(row.value) + '">' + escapeHtml(row.label) + '</option>';
    });
    if (!rows.length) html += '<option value="" disabled>Tidak ada rak/tanggal produksi yang cocok</option>';
    if (rows.length > 150) html += '<option value="" disabled>Menampilkan 150 dari ' + rows.length + ' hasil. Persempit pencarian.</option>';
    select.innerHTML = html;
    if (current && rows.some(function(r) { return r.value === current; })) select.value = current;
  }


  function dateInputFromDate(dateObj) {
    var yyyy = dateObj.getFullYear();
    var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    var dd = String(dateObj.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function formatPercent(value) {
    var num = Number(value || 0);
    return num.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  function loadOccupancyReport() {
    var target = byId('occupancy_table');
    if (!authToken) return;
    if (target) target.innerHTML = '<div class="empty">Memuat grafik okupansi...</div>';
    showMsg('msg_occupancy', 'Memuat occupancy gudang...', true);

    google.script.run
      .withSuccessHandler(function(res) {
        renderOccupancyReport(res);
        showMsg('msg_occupancy', 'Grafik occupancy berhasil dimuat. Data dibuat: ' + (res.generatedAt || '-'), true);
      })
      .withFailureHandler(function(err) {
        showMsg('msg_occupancy', err.message || err, false);
        if (target) target.innerHTML = '<div class="empty">Gagal memuat occupancy: ' + escapeHtml(err.message || err) + '</div>';
      })
      .getWarehouseOccupancyReport({
        auth: getAuthPayload(),
        startDate: val('occ_startDate'),
        endDate: val('occ_endDate')
      });
  }

  function renderOccupancyReport(res) {
    res = res || {};
    var summary = res.summary || {};
    var capacity = res.capacity || {};

    text('occ_capacity_total', formatNumber(capacity.total || 0));
    text('occ_capacity_rack', formatNumber(capacity.rackWithCapacity || 0) + ' rak DEDICATED dengan kapasitas / ' + formatNumber(capacity.totalRack || 0) + ' rak DEDICATED. FLOOR: ' + formatNumber(capacity.floorRack || 0));
    text('occ_release_pct', formatPercent(summary.releasePct || 0));
    text('occ_release_qty', formatNumber(summary.releaseQty || 0) + ' qty release');
    text('occ_hold_pct', formatPercent(summary.holdPct || 0));
    text('occ_hold_qty', formatNumber(summary.holdQty || 0) + ' qty hold');
    text('occ_total_pct', formatPercent(summary.totalPct || 0));
    text('occ_total_qty', formatNumber(summary.totalQty || 0) + ' qty dedicated | Space: ' + formatNumber(summary.spaceQty || 0) + ' | Floor: ' + formatNumber(summary.floorQty || 0));

    drawOccupancyChart(res.daily || []);
    renderOccupancyTable(res.daily || []);

    if (res.rackCapacities) {
      master.rakKapasitas = res.rackCapacities;
      renderRackCapacityEditor();
    }
  }

  function drawOccupancyChart(rows) {
    var canvas = byId('occ_chart_canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var width = Math.max(320, rect.width || 720);
    var height = 280;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.fillText('OKUPANSI COLD STORAGE WH', width / 2, 18);

    if (!rows.length) {
      ctx.fillStyle = '#64748b';
      ctx.fillText('Belum ada data okupansi.', width / 2, height / 2);
      return;
    }

    var padLeft = 46;
    var padRight = 16;
    var padTop = 36;
    var padBottom = 44;
    var plotW = width - padLeft - padRight;
    var plotH = height - padTop - padBottom;
    var maxPct = 100;
    rows.forEach(function(r) {
      maxPct = Math.max(maxPct, Number(r.releasePct || 0), Number(r.holdPct || 0), Number(r.totalPct || 0));
    });
    var yMax = Math.ceil(maxPct / 25) * 25;
    if (yMax < 100) yMax = 100;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#475569';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    for (var y = 0; y <= yMax; y += 25) {
      var py = padTop + plotH - (y / yMax) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, py);
      ctx.lineTo(width - padRight, py);
      ctx.stroke();
      ctx.fillText(y.toFixed(0) + ',00%', padLeft - 6, py + 3);
    }

    function xAt(i) {
      if (rows.length === 1) return padLeft + plotW / 2;
      return padLeft + (i / (rows.length - 1)) * plotW;
    }
    function yAt(value) {
      return padTop + plotH - (Number(value || 0) / yMax) * plotH;
    }
    function drawLine(field, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      rows.forEach(function(r, idx) {
        var x = xAt(idx);
        var y = yAt(r[field]);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    drawLine('releasePct', '#2563eb');
    drawLine('holdPct', '#ef4444');
    drawLine('totalPct', '#eab308');

    ctx.fillStyle = '#475569';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    var step = Math.max(1, Math.ceil(rows.length / 10));
    rows.forEach(function(r, idx) {
      if (idx % step !== 0 && idx !== rows.length - 1) return;
      var x = xAt(idx);
      ctx.save();
      ctx.translate(x, height - 28);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(r.tanggalLabel || r.tanggal || '', 0, 0);
      ctx.restore();
    });

    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.font = '11px Arial';
    ctx.fillText('Tanggal', padLeft + plotW / 2, height - 5);
  }

  function renderOccupancyTable(rows) {
    var div = byId('occupancy_table');
    if (!div) return;
    if (!rows.length) {
      div.innerHTML = '<div class="empty">Belum ada data occupancy.</div>';
      return;
    }
    var html = '<table><thead><tr><th>Tanggal</th><th>Release</th><th>Hold</th><th>Total Dedicated</th><th>Space</th><th>Rak Dedicated Terisi</th><th>Stock Floor</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      html += '<tr>' +
        '<td><b>' + escapeHtml(r.tanggal) + '</b></td>' +
        '<td>' + formatPercent(r.releasePct) + '<br><span class="small">' + formatNumber(r.releaseQty) + ' qty</span></td>' +
        '<td>' + formatPercent(r.holdPct) + '<br><span class="small">' + formatNumber(r.holdQty) + ' qty</span></td>' +
        '<td><b>' + formatPercent(r.totalPct) + '</b><br><span class="small">' + formatNumber(r.totalQty) + ' / ' + formatNumber(r.capacityTotal) + '</span></td>' +
        '<td>' + formatPercent(r.spacePct) + '<br><span class="small">' + formatNumber(r.spaceQty) + ' qty kosong</span></td>' +
        '<td>' + formatNumber(r.occupiedRackCount) + ' / ' + formatNumber(r.rackCountTotal) + '</td>' +
        '<td>' + formatNumber(r.floorQty || 0) + ' qty<br><span class="small">' + formatNumber(r.floorOccupiedRackCount || 0) + ' titik floor</span></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    div.innerHTML = html;
  }

  function inferRackTypeClient(lokasiRak) {
    var key = String(lokasiRak || '').toUpperCase().trim().replace(/\s+/g, ' ');
    if (!key) return '';
    if (key.indexOf('GANGWAY') !== -1 || key.indexOf('GANG WAY') !== -1 || key.indexOf('GANG') === 0 || key.indexOf('T') === 0) return 'FLOOR';
    if (key.indexOf('R') === 0 || key.indexOf('RAK') === 0) return 'DEDICATED';
    return 'FLOOR';
  }

  function normalizeRackTypeClient(jenisRak, lokasiRak) {
    var key = String(jenisRak || '').toUpperCase().trim();
    if (key === 'FLOOR' || key === 'LANTAI' || key === 'GANGWAY' || key === 'GANG WAY') return 'FLOOR';
    if (key === 'DEDICATED' || key === 'RAK DEDICATED' || key === 'RACK DEDICATED') return 'DEDICATED';
    return inferRackTypeClient(lokasiRak);
  }

  function renderRackCapacityEditor() {
    var div = byId('rack_capacity_editor');
    if (!div) return;
    var list = [];
    var capMap = {};
    var typeMap = {};
    (master.rakKapasitas || []).forEach(function(item) {
      var key = String(item.lokasiRak || '').toUpperCase().trim();
      capMap[key] = item.kapasitasRak;
      typeMap[key] = normalizeRackTypeClient(item.jenisRak, item.lokasiRak);
    });
    (master.rak || []).forEach(function(rak) {
      if (!rak) return;
      var key = String(rak).toUpperCase().trim();
      list.push({ lokasiRak: rak, kapasitasRak: capMap[key] || 0, jenisRak: typeMap[key] || inferRackTypeClient(rak) });
    });
    (master.rakKapasitas || []).forEach(function(item) {
      var exists = list.some(function(r) { return String(r.lokasiRak).toUpperCase().trim() === String(item.lokasiRak).toUpperCase().trim(); });
      if (!exists && item.lokasiRak) {
        list.push({ lokasiRak: item.lokasiRak, kapasitasRak: item.kapasitasRak || 0, jenisRak: normalizeRackTypeClient(item.jenisRak, item.lokasiRak) });
      }
    });

    if (!list.length) {
      div.innerHTML = '<div class="empty">Belum ada data rak. Isi DATABASE_RAK dahulu.</div>';
      return;
    }

    var disabled = currentUser && currentUser.access && currentUser.access.supervisor ? '' : ' disabled';
    var html = '<table class="rack-capacity-table"><thead><tr><th>Lokasi Rak</th><th>Jenis Rak</th><th>Kapasitas Rak</th><th>Hitung Occupancy</th></tr></thead><tbody>';
    list.forEach(function(r, idx) {
      var jenisRak = normalizeRackTypeClient(r.jenisRak, r.lokasiRak);
      var dedicatedSelected = jenisRak === 'DEDICATED' ? ' selected' : '';
      var floorSelected = jenisRak === 'FLOOR' ? ' selected' : '';
      var countedText = jenisRak === 'DEDICATED' ? 'YA' : 'TIDAK';
      html += '<tr><td><b>' + escapeHtml(r.lokasiRak) + '</b><input type="hidden" id="cap_rak_' + idx + '" value="' + escapeHtml(r.lokasiRak) + '"></td>' +
        '<td><select id="cap_type_' + idx + '"' + disabled + '><option value="DEDICATED"' + dedicatedSelected + '>DEDICATED</option><option value="FLOOR"' + floorSelected + '>FLOOR</option></select><div class="small">Auto: R/RAK = Dedicated, GANGWAY/T = Floor</div></td>' +
        '<td><input type="text" inputmode="numeric" pattern="[0-9]*" id="cap_qty_' + idx + '" value="' + escapeHtml(r.kapasitasRak || 0) + '" onkeydown="return preventQtyDecimal(event)" oninput="normalizeQtyInput(this)"' + disabled + '></td>' +
        '<td><span class="badge ' + (jenisRak === 'DEDICATED' ? 'success' : 'warning') + '">' + countedText + '</span></td></tr>';
    });
    html += '</tbody></table>';
    div.innerHTML = html;
  }

  function saveRackCapacities() {
    if (!currentUser || !currentUser.access || !currentUser.access.supervisor) {
      showMsg('msg_occupancy', 'Hanya Supervisor yang bisa menyimpan kapasitas rak.', false);
      return;
    }

    var rows = [];
    Array.prototype.forEach.call(document.querySelectorAll('[id^="cap_rak_"]'), function(el) {
      var idx = el.id.replace('cap_rak_', '');
      rows.push({ lokasiRak: el.value, kapasitasRak: val('cap_qty_' + idx) || '0', jenisRak: val('cap_type_' + idx) || inferRackTypeClient(el.value) });
    });

    showMsg('msg_occupancy', 'Menyimpan kapasitas rak...', true);
    google.script.run
      .withSuccessHandler(function(res) {
        showMsg('msg_occupancy', res.message || 'Kapasitas rak tersimpan.', true);
        if (res.rows) master.rakKapasitas = res.rows;
        renderRackCapacityEditor();
        loadOccupancyReport();
      })
      .withFailureHandler(function(err) {
        showMsg('msg_occupancy', err.message || err, false);
      })
      .saveRackCapacities({ auth: getAuthPayload(), rows: rows });
  }

  function renderDashboard() {
    if (!masterLoaded) {
      renderDashboardLoading_();
      loadDashboardSummaryData(false);
      loadDashboardStockCpReport();
      return;
    }
    renderDashboardFromStock_(master.stock || [], master.otdr || []);
    if (!master.stock || !master.stock.length) loadDashboardSummaryData(true);
    loadDashboardStockCpReport();
  }

  function renderDashboardFromStock_(stockRows, otdrRows) {
    var stock = normalizeStockListClient_(stockRows).filter(function(s) { return Number(s.stockOnhand || 0) > 0; });
    var totalQty = stock.reduce(function(sum, s) { return sum + Number(s.stockOnhand || 0); }, 0);
    var expSoon = stock.filter(function(s) { return daysToExpired(s.tanggalExpired) <= 30; });
    var pending = (otdrRows || []).filter(function(o) { return !isOtdrDoneClient(o.statusOtdr); });
    text('dash_total_qty', formatNumber(totalQty)); text('dash_total_lot', stock.length); text('dash_exp_soon', expSoon.length); text('dash_otdr_pending', pending.length);
    renderExpiringTable(stock);
  }

  function loadDashboardSummaryData(force) {
    if (!authToken || dashboardSummaryLoading) return;
    if (!force && masterLoaded) return;
    dashboardSummaryLoading = true;
    google.script.run
      .withSuccessHandler(function(res) {
        dashboardSummaryLoading = false;
        if (!res || !res.ok) return;
        master.stock = normalizeStockListClient_(res.stock || []);
        master.lotRakBatch = Array.isArray(res.lotRakBatch) ? res.lotRakBatch : [];
        master.otdr = Array.isArray(res.otdr) ? res.otdr : [];
        if (Array.isArray(res.barang) && res.barang.length) master.barang = res.barang;
        if (Array.isArray(res.status) && res.status.length) master.status = res.status;
        if (Array.isArray(res.koordinator) && res.koordinator.length) master.koordinator = res.koordinator;
        if (Array.isArray(res.rak) && res.rak.length) master.rak = res.rak;
        if (Array.isArray(res.rakKapasitas) && res.rakKapasitas.length) master.rakKapasitas = res.rakKapasitas;
        if (Array.isArray(res.resto) && res.resto.length) master.resto = res.resto;
        try { populateAllSelects(); } catch (uiErr) {}
        if (res.syncWarning) master.syncWarning = res.syncWarning;
        if (res.summary) {
          text('dash_total_qty', formatNumber(res.summary.totalQty || 0));
          text('dash_total_lot', res.summary.totalLot || 0);
          text('dash_exp_soon', res.summary.expSoon || 0);
          text('dash_otdr_pending', res.summary.otdrPending || 0);
        } else {
          renderDashboardFromStock_(master.stock, master.otdr);
        }
        renderExpiringTable(master.stock);
        renderStockTable();
        refreshAllOutputLineSelects();
        refreshLocationStockOptions();
      })
      .withFailureHandler(function(err) {
        dashboardSummaryLoading = false;
        showDashboardError_('Gagal membaca STOCK_ONHAND dari Spreadsheet: ' + escapeHtml(err.message || err));
      })
      .getDashboardSummaryData({ auth: getAuthPayload() });
  }


  function loadDashboardStockCpReport() {
    var target = byId('dash_stockcp_table');
    if (!target || !authToken) return;

    var tanggal = val('dash_stock_date');
    var area = val('dash_stock_area') || 'FG 3';
    target.innerHTML = '<div class="empty">Memuat report stock ' + escapeHtml(tanggal || '') + '...</div>';

    google.script.run
      .withSuccessHandler(function(res) {
        renderDashboardStockCpReport(res);
      })
      .withFailureHandler(function(err) {
        target.innerHTML = '<div class="empty">Gagal memuat report stock: ' + escapeHtml(err.message || err) + '</div>';
      })
      .getDashboardStockCpReport({
        auth: getAuthPayload(),
        tanggal: tanggal,
        areaLabel: area,
        title: 'DAILY STOCK',
        subTitle: 'STOCK CP3'
      });
  }

  function renderDashboardStockCpReport(res) {
    var div = byId('dash_stockcp_table');
    if (!div) return;

    var rows = res.rows || [];
    var totals = res.totals || { release: 0, hold: 0, waste: 0, total: 0 };

    var html = '';
    html += '<div class="stockcp-titlebar">';
    html += '<div>' + escapeHtml(res.tanggalLabel || res.tanggal || '') + '</div>';
    html += '<div><span class="stockcp-area-select">' + escapeHtml(res.areaLabel || 'FG 3') + '</span></div>';
    html += '<div>' + escapeHtml(res.title || 'DAILY STOCK') + '</div>';
    html += '</div>';
    html += '<div class="stockcp-subtitle">' + escapeHtml(res.subTitle || 'STOCK CP3') + '</div>';

    if (!rows.length) {
      html += '<div class="empty">Tidak ada stock untuk tanggal ini.</div>';
      div.innerHTML = html;
      return;
    }

    html += '<div class="stockcp-table-wrap">';
    html += '<table class="stockcp-table">';
    html += '<thead><tr>';
    html += '<th class="name-head">NAMA BARANG</th>';
    html += '<th class="satuan-head">SATUAN</th>';
    html += '<th class="release-head">RELEASE</th>';
    html += '<th class="hold-head">HOLD</th>';
    html += '<th class="waste-head">WASTE</th>';
    html += '<th class="total-head">QTY<br>CARTON</th>';
    html += '</tr></thead><tbody>';

    rows.forEach(function(r) {
      html += '<tr>';
      html += '<td class="nama">' + escapeHtml(r.namaBarang) + '</td>';
      html += '<td class="satuan">' + escapeHtml(r.satuan || 'KARTON') + '</td>';
      html += '<td class="num">' + formatNumber(r.release) + '</td>';
      html += '<td class="num">' + formatNumber(r.hold) + '</td>';
      html += '<td class="num">' + formatNumber(r.waste) + '</td>';
      html += '<td class="num">' + formatNumber(r.total) + '</td>';
      html += '</tr>';
    });

    html += '</tbody><tfoot><tr>';
    html += '<td class="nama">TOTAL</td>';
    html += '<td></td>';
    html += '<td class="num">' + formatNumber(totals.release) + '</td>';
    html += '<td class="num">' + formatNumber(totals.hold) + '</td>';
    html += '<td class="num">' + formatNumber(totals.waste) + '</td>';
    html += '<td class="num">' + formatNumber(totals.total) + '</td>';
    html += '</tr></tfoot></table></div>';

    if (res.sourceMode === 'MUTASI_HISTORY') {
      html += '<div class="stockcp-note">Mode tanggal lampau: dihitung dari histori MUTASI_BARANG sampai akhir tanggal yang dipilih.</div>';
    } else {
      html += '<div class="stockcp-note">Mode hari ini/masa depan: menggunakan data current dari STOCK_ONHAND.</div>';
    }

    div.innerHTML = html;
  }

  function renderExpiringTable(stock) {
    var arr = stock.slice().sort(function(a,b) { return daysToExpired(a.tanggalExpired) - daysToExpired(b.tanggalExpired); }).slice(0, 6);
    var div = byId('dash_exp_table');
    if (!arr.length) { div.innerHTML = '<div class="empty">Belum ada stock tersedia.</div>'; return; }
    var html = '<table><thead><tr><th>Barang / Lot</th><th>Batch</th><th>Exp</th><th>Stock</th><th>Rak</th></tr></thead><tbody>';
    arr.forEach(function(s) { var d = daysToExpired(s.tanggalExpired); var badge = d < 0 ? 'Expired' : d + ' hari'; html += '<tr><td><b>' + escapeHtml(s.namaBarang) + '</b><br><span class="small">ID Lot: ' + escapeHtml(s.idStock) + '<br>PIC/User: ' + escapeHtml(s.namaUserInputTerakhir || '-') + '</span></td><td><b>' + escapeHtml(s.nomorBatch || '-') + '</b><br><span class="small">BSTB: ' + escapeHtml(s.nomorBSTB || '-') + '</span></td><td>' + escapeHtml(s.tanggalExpired) + '<br><span class="badge warning">' + escapeHtml(badge) + '</span></td><td>' + escapeHtml(s.stockOnhand) + ' ' + escapeHtml(s.satuan) + '</td><td>' + escapeHtml(s.lokasiRak) + '</td></tr>'; });
    html += '</tbody></table>'; div.innerHTML = html;
  }

  function loadQcFifoMonitoring(forceRefresh) {
    if (!currentUser || !currentUser.access || (!currentUser.access.fifoQc && !currentUser.access.supervisor)) {
      showMsg('msg_fifoqc', 'Menu QC FIFO hanya untuk Quality Control dan Supervisor.', false);
      return;
    }
    if (!forceRefresh && fifoQcRows && fifoQcRows.length) {
      renderFifoQcMonitoring();
      return;
    }
    showMsg('msg_fifoqc', 'Memuat monitoring FEFO/QC dari STOCK_ONHAND...', true);
    google.script.run.withSuccessHandler(function(res) {
      fifoQcRows = normalizeStockListClient_(res && res.rows ? res.rows : []);
      fifoQcLastLoadedAt = (res && res.generatedAt) || '';
      if (fifoQcRows.length) {
        master.stock = fifoQcRows.slice();
      }
      refreshFifoQcFilterOptions_(fifoQcRows);
      showMsg('msg_fifoqc', 'Monitoring FEFO/QC berhasil dimuat. Total lot aktif: ' + fifoQcRows.length + (fifoQcLastLoadedAt ? ' | Update: ' + fifoQcLastLoadedAt : ''), true);
      renderFifoQcMonitoring();
    }).withFailureHandler(function(err) {
      showMsg('msg_fifoqc', 'Gagal refresh monitoring QC dari backend. Menampilkan data terakhir di frontend. Detail: ' + ((err && err.message) || err), false);
      fifoQcRows = normalizeStockListClient_(master.stock || []);
      refreshFifoQcFilterOptions_(fifoQcRows);
      renderFifoQcMonitoring();
    }).getQcFifoMonitoring({ auth: getAuthPayload() });
  }

  function refreshFifoQcFilterOptions_(rows) {
    rows = normalizeStockListClient_(rows || []);
    var currentNama = val('fifo_namaBarang');
    var currentStatus = val('fifo_status');
    var nameMap = {};
    rows.forEach(function(item) { if (item.namaBarang) nameMap[item.namaBarang] = true; });
    (master.barang || []).forEach(function(item) { if (item && item.nama) nameMap[item.nama] = true; });
    var names = Object.keys(nameMap).sort().map(function(name) { return { value:name, label:name }; });

    var statusMap = {};
    rows.forEach(function(item) { if (item.status) statusMap[item.status] = true; });
    (master.status || []).forEach(function(status) { if (status) statusMap[status] = true; });
    statusMap.HOLD = true;
    statusMap.RELEASE = true;
    statusMap.GOOD = true;
    var statuses = Object.keys(statusMap).sort().map(function(status) { return { value:status, label:status }; });

    fillSelect('fifo_namaBarang', [{value:'', label:'Semua'}].concat(names), false);
    fillSelect('fifo_status', [{value:'', label:'Semua'}, {value:'__HOLD__', label:'Kategori HOLD'}, {value:'__RELEASE__', label:'Kategori RELEASE/GOOD'}].concat(statuses), false);
    if (byId('fifo_namaBarang') && currentNama) byId('fifo_namaBarang').value = currentNama;
    if (byId('fifo_status') && currentStatus) byId('fifo_status').value = currentStatus;
  }

  function renderFifoQcMonitoring() {
    var div = byId('fifoqc_table');
    if (!div) return;

    var sourceRows = (fifoQcRows && fifoQcRows.length ? fifoQcRows : (master.stock || []));
    var stock = normalizeStockListClient_(sourceRows).filter(function(s) { return Number(s.stockOnhand || 0) > 0; });
    var nama = val('fifo_namaBarang');
    var status = val('fifo_status');
    var maxDays = Number(val('fifo_maxDays') || 0);
    var q = normalizeSearchTextClient(val('fifo_search'));

    if (!stock.length) {
      text('fifo_total_lot', 0);
      text('fifo_priority_lot', 0);
      text('fifo_expired_lot', 0);
      text('fifo_hold_lot', 0);
      div.innerHTML = '<div class="empty">Data STOCK_ONHAND belum terbaca untuk monitoring FEFO/QC. Klik <b>Refresh Monitoring QC</b>, lalu cek kolom Stock Onhand bila masih kosong.</div>';
      return;
    }

    if (nama) stock = stock.filter(function(s) { return String(s.namaBarang || '') === nama; });
    if (status) {
      stock = stock.filter(function(s) {
        var category = fifoQcStatusCategoryClient(s.status);
        if (status === '__HOLD__') return category === 'HOLD';
        if (status === '__RELEASE__') return category === 'RELEASE';
        return String(s.status || '') === status;
      });
    }
    if (q) {
      stock = stock.filter(function(s) {
        return normalizeSearchTextClient([s.idStock, s.namaBarang, s.nomorBatch, s.status, s.lokasiRak, s.nomorBSTB, s.tanggalProduksi, s.tanggalExpired, s.satuan, s.namaUserInputTerakhir].join(' ')).indexOf(q) !== -1;
      });
    }

    stock.sort(function(a, b) {
      var byName = String(a.namaBarang || '').localeCompare(String(b.namaBarang || ''));
      if (byName !== 0) return byName;
      var byExp = daysToExpired(a.tanggalExpired) - daysToExpired(b.tanggalExpired);
      if (byExp !== 0) return byExp;
      var byProd = String(a.tanggalProduksi || '').localeCompare(String(b.tanggalProduksi || ''));
      if (byProd !== 0) return byProd;
      return String(a.idStock || '').localeCompare(String(b.idStock || ''));
    });

    var allForMetric = normalizeStockListClient_(sourceRows).filter(function(s) { return Number(s.stockOnhand || 0) > 0; });
    text('fifo_total_lot', allForMetric.length);
    text('fifo_priority_lot', allForMetric.filter(function(s) { return daysToExpired(s.tanggalExpired) <= 30; }).length);
    text('fifo_expired_lot', allForMetric.filter(function(s) { return daysToExpired(s.tanggalExpired) < 0; }).length);
    text('fifo_hold_lot', allForMetric.filter(function(s) { return fifoQcStatusCategoryClient(s.status) === 'HOLD'; }).length);

    var rankByItemAll = {};
    allForMetric.slice().sort(function(a, b) {
      var byName = String(a.namaBarang || '').localeCompare(String(b.namaBarang || ''));
      if (byName !== 0) return byName;
      var byExp = daysToExpired(a.tanggalExpired) - daysToExpired(b.tanggalExpired);
      if (byExp !== 0) return byExp;
      return String(a.idStock || '').localeCompare(String(b.idStock || ''));
    }).forEach(function(s) {
      var itemKey = String(s.namaBarang || '-');
      rankByItemAll[itemKey] = (rankByItemAll[itemKey] || 0) + 1;
      s._fifoRank = rankByItemAll[itemKey];
    });

    var enriched = stock.map(function(s) {
      var days = daysToExpired(s.tanggalExpired);
      var statusCategory = fifoQcStatusCategoryClient(s.status);
      var isHold = statusCategory === 'HOLD';
      var kategori = 'FEFO NORMAL';
      var badgeClass = 'success';
      if (days < 0) { kategori = 'EXPIRED - QC CEK'; badgeClass = 'danger'; }
      else if (days <= 7) { kategori = 'PRIORITAS FEFO ≤ 7 HARI'; badgeClass = 'danger'; }
      else if (days <= 30) { kategori = 'PRIORITAS FEFO ≤ 30 HARI'; badgeClass = 'warning'; }
      if (isHold) { kategori = 'HOLD - QC RELEASE DULU'; badgeClass = 'warning'; }
      return { data:s, rank:s._fifoRank || '-', days:days, statusCategory:statusCategory, kategori:kategori, badgeClass:badgeClass };
    });

    var shown = enriched.filter(function(r) {
      if (maxDays > 0 && r.days > maxDays) return false;
      return true;
    });

    var infoHtml = '<div class="small"><b>Monitoring FEFO:</b> Urutan #1 adalah lot yang harus keluar lebih dulu untuk item tersebut. Tombol QC hanya mengubah status <b>HOLD ↔ RELEASE</b>, lokasi rak tidak berubah.' + (fifoQcLastLoadedAt ? ' Data refresh: <b>' + escapeHtml(fifoQcLastLoadedAt) + '</b>.' : '') + '</div>';
    if (!shown.length && maxDays > 0) {
      div.innerHTML = infoHtml + '<div class="empty">Tidak ada lot dalam batas prioritas ≤ ' + escapeHtml(maxDays) + ' hari. Ubah filter <b>Batas Monitoring FEFO</b> menjadi <b>Semua lot aktif</b> agar tabel dan tombol update status terlihat.</div>';
      return;
    }
    if (!shown.length) {
      div.innerHTML = infoHtml + '<div class="empty">Tidak ada lot yang sesuai filter pencarian/status/nama barang.</div>';
      return;
    }

    var html = '<div class="form-table-wrap"><table class="form-table"><thead><tr><th>Urutan FEFO</th><th>Nama Barang / ID Stock</th><th>Batch</th><th>Expired / Umur</th><th>Stock</th><th>Rak</th><th>Status QC</th><th>Aksi QC</th><th>BSTB / PIC</th></tr></thead><tbody>';
    shown.forEach(function(r) {
      var s = r.data;
      var daysLabel = r.days === 99999 || r.days === 999999 ? '-' : (r.days < 0 ? 'Lewat ' + Math.abs(r.days) + ' hari' : r.days + ' hari lagi');
      var actionHtml = '<span class="small">Status ini tidak bisa diubah dari menu QC FIFO</span>';
      if (r.statusCategory === 'HOLD') {
        actionHtml = '<button class="success mini" onclick="submitFifoQcStatus(\\'' + escapeJs(s.idStock) + '\\', \\'RELEASE\\')">✅ Release</button>';
      } else if (r.statusCategory === 'RELEASE') {
        actionHtml = '<button class="warning mini" onclick="submitFifoQcStatus(\\'' + escapeJs(s.idStock) + '\\', \\'HOLD\\')">⏸ Hold</button>';
      }
      html += '<tr>' +
        '<td class="center"><b>#' + escapeHtml(r.rank) + '</b><br><span class="small">prioritas item</span></td>' +
        '<td><b>' + escapeHtml(s.namaBarang || '-') + '</b><br><span class="small">ID: ' + escapeHtml(s.idStock || '-') + '<br>Produksi: ' + escapeHtml(s.tanggalProduksi || '-') + '</span></td>' +
        '<td><b>' + escapeHtml(s.nomorBatch || '-') + '</b><br><span class="small">Relasi rak-batch</span></td>' +
        '<td><b>' + escapeHtml(s.tanggalExpired || '-') + '</b><br><span class="badge ' + r.badgeClass + '">' + escapeHtml(daysLabel) + '</span></td>' +
        '<td><b>' + escapeHtml(s.stockOnhand || 0) + '</b> ' + escapeHtml(s.satuan || '') + '</td>' +
        '<td><b>' + escapeHtml(s.lokasiRak || '-') + '</b></td>' +
        '<td><span class="badge ' + r.badgeClass + '">' + escapeHtml(r.kategori) + '</span><br><span class="small">Status sheet: ' + escapeHtml(s.status || '-') + '</span></td>' +
        '<td><div class="action-stack">' + actionHtml + '</div></td>' +
        '<td>' + escapeHtml(s.nomorBSTB || '-') + '<br><span class="small">PIC/User: ' + escapeHtml(s.namaUserInputTerakhir || '-') + '</span></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    div.innerHTML = infoHtml + html;
  }


  function fifoQcStatusCategoryClient(status) {
    var key = String(status || '').toUpperCase().trim();
    if (key === 'HOLD') return 'HOLD';
    if (key === 'RELEASE' || key === 'GOOD') return 'RELEASE';
    return 'OTHER';
  }

  function submitFifoQcStatus(idStock, statusBaru) {
    if (!idStock || !statusBaru) return;
    if (!currentUser || !currentUser.access || (!currentUser.access.fifoQc && !currentUser.access.supervisor)) {
      showMsg('msg_fifoqc', 'Menu update status QC FIFO hanya untuk QC dan Supervisor.', false);
      return;
    }
    var item = (master.stock || []).find(function(s) { return s.idStock === idStock; }) || {};
    var statusLama = item.status || '-';
    var confirmText = 'Update status QC FIFO?\\n\\nID Stock: ' + idStock + '\\nBarang: ' + (item.namaBarang || '-') + '\\nBatch: ' + (item.nomorBatch || '-') + '\\nRak: ' + (item.lokasiRak || '-') + '\\nStatus lama: ' + statusLama + '\\nStatus baru: ' + statusBaru + '\\n\\nMenu ini hanya mengubah status HOLD ↔ RELEASE dan tidak memindahkan lokasi rak.';
    if (!confirm(confirmText)) return;
    var ket = prompt('Catatan QC / alasan update status:', 'Update status QC FIFO dari ' + statusLama + ' ke ' + statusBaru);
    if (ket === null) return;

    showMsg('msg_fifoqc', 'Menyimpan update status QC FIFO...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_fifoqc', res.message || 'Status QC FIFO berhasil diupdate.', true);
      var updated = (master.stock || []).find(function(s) { return s.idStock === idStock; });
      if (updated) {
        updated.status = res.statusBaru || statusBaru;
        updated.namaUserInputTerakhir = currentUser ? currentUser.namaUser : updated.namaUserInputTerakhir;
      }
      var updatedQc = (fifoQcRows || []).find(function(s) { return s.idStock === idStock; });
      if (updatedQc) {
        updatedQc.status = res.statusBaru || statusBaru;
        updatedQc.namaUserInputTerakhir = currentUser ? currentUser.namaUser : updatedQc.namaUserInputTerakhir;
      }
      refreshFifoQcFilterOptions_(fifoQcRows && fifoQcRows.length ? fifoQcRows : (master.stock || []));
      renderFifoQcMonitoring();
      renderStockTable();
      renderDashboardFromStock_(master.stock || [], master.otdr || []);
    }).withFailureHandler(function(err) {
      showMsg('msg_fifoqc', err.message || err, false);
    }).updateQcFifoStatus({ idStock: idStock, statusBaru: statusBaru, keterangan: ket, auth: getAuthPayload() });
  }

  function renderStockTable() {
    var div = byId('stock_table');
    if (!div) return;
    if (!master.stock || master.stock.length === 0) { div.innerHTML = '<div class="empty">Belum ada stock tersedia dari STOCK_ONHAND. Cek kolom Stock Onhand dan jalankan setupInventorySystem().</div>'; return; }
    var html = '<table><thead><tr><th>Barang / ID Lot</th><th>Batch dari Database</th><th>Tgl Prod / Exp</th><th>Rak</th><th>Stock</th><th>Status</th></tr></thead><tbody>';
    master.stock.forEach(function(s) { html += '<tr><td><b>' + escapeHtml(s.namaBarang) + '</b><br><span class="small">ID Lot: ' + escapeHtml(s.idStock) + '</span></td><td><b>' + escapeHtml(s.nomorBatch || '-') + '</b><br><span class="small">BSTB: ' + escapeHtml(s.nomorBSTB || '-') + '</span></td><td>Prod: ' + escapeHtml(s.tanggalProduksi || '-') + '<br>Exp: ' + escapeHtml(s.tanggalExpired || '-') + '</td><td>' + escapeHtml(s.lokasiRak) + '</td><td><b>' + escapeHtml(s.stockOnhand) + '</b> ' + escapeHtml(s.satuan) + '</td><td><span class="badge">' + escapeHtml(s.status) + '</span><br><span class="small">PIC: ' + escapeHtml(s.namaUserInputTerakhir || '-') + '</span></td></tr>'; });
    html += '</tbody></table><div class="small">Relasi aktif diambil dari sheet RELASI_RAK_BATCH. Satu rak boleh berisi lebih dari satu batch karena pembeda utama adalah ID Lot/ID Stock + Nomor Batch + Rak.</div>'; div.innerHTML = html;
  }

  function loadStockOpnameForm() {
    if (!currentUser || !currentUser.access || !currentUser.access.stockOpname) {
      showMsg('msg_stockopname', 'Menu Stock Opname hanya untuk akun Inventory dan Supervisor.', false);
      return;
    }

    var filter = {
      namaBarang: val('op_namaBarang'),
      status: val('op_status'),
      lokasiRak: val('op_lokasiRak'),
      onlyAvailable: true
    };

    showMsg('msg_stockopname', 'Membuat form stock opname...', true);
    google.script.run
      .withSuccessHandler(function(res) {
        stockOpnameCurrent = res || { rows: [] };
        renderStockOpnameForm(stockOpnameCurrent);
        showMsg('msg_stockopname', 'Form Stock Opname dibuat: ' + ((stockOpnameCurrent.rows || []).length) + ' lot/baris.', true);
      })
      .withFailureHandler(function(err) {
        showMsg('msg_stockopname', err.message || err, false);
      })
      .getStockOpnameForm({ auth: getAuthPayload(), filter: filter });
  }

  function renderStockOpnameForm(res) {
    res = res || { rows: [], summary: {}, filters: {} };
    var rows = res.rows || [];
    var div = byId('stockopname_print_area');
    if (!div) return;

    if (!rows.length) {
      div.innerHTML = '<div class="empty">Tidak ada stock onhand sesuai filter.</div>';
      return;
    }

    var filters = res.filters || {};
    var summary = res.summary || {};
    var filterText = [];
    if (filters.namaBarang) filterText.push('Barang: ' + filters.namaBarang);
    if (filters.status) filterText.push('Status: ' + filters.status);
    if (filters.lokasiRak) filterText.push('Rak: ' + filters.lokasiRak);
    if (!filterText.length) filterText.push('Semua stock tersedia');

    var html = '';
    html += '<div class="stockopname-doc">';
    html += '<div class="stockopname-head">';
    html += '<div class="stockopname-meta"><b>Gudang / Area:</b> ____________________<br><b>Shift:</b> ____________<br><b>Catatan:</b> Form untuk cek Qty Actual fisik vs Qty Sistem.</div>';
    html += '<div class="stockopname-title">FORM STOCK OPNAME<br><span style="font-size:11px;font-weight:700;">CEK QTY ACTUAL</span></div>';
    html += '<div class="stockopname-meta"><b>Tanggal Cetak:</b> ' + escapeHtml(res.generatedAt || '') + '<br><b>Dicetak Oleh:</b> ' + escapeHtml(res.generatedBy || '') + '<br><b>Filter:</b> ' + escapeHtml(filterText.join(' | ')) + '</div>';
    html += '</div>';

    html += '<div class="stockopname-summary">';
    html += '<div><b>Total Lot</b><br>' + escapeHtml(summary.totalLot || rows.length) + '</div>';
    html += '<div><b>Total Qty Sistem</b><br>' + escapeHtml(formatNumber(summary.totalQtySystem || 0)) + '</div>';
    html += '<div><b>Status Pengecekan</b><br>Isi Qty Actual untuk melihat Sesuai/Tidak Sesuai</div>';
    html += '</div>';

    html += '<table class="stockopname-table"><thead><tr>';
    html += '<th>No</th><th>ID Stock</th><th>Nama Barang</th><th>Batch</th><th>Tgl Prod</th><th>Tgl Exp</th><th>Status</th><th>Rak</th><th>No/Tgl BSTB</th><th>PIC Input/Update</th><th>Qty Sistem</th><th>Satuan</th><th>Qty Actual</th><th>Selisih</th><th>Kesesuaian</th><th>Keterangan</th>';
    html += '</tr></thead><tbody>';

    rows.forEach(function(r, idx) {
      var bstbText = escapeHtml(r.nomorBSTB || '') + (r.tanggalBSTB ? '<br>' + escapeHtml(r.tanggalBSTB) : '');
      html += '<tr>';
      html += '<td class="center">' + escapeHtml(r.no) + '</td>';
      html += '<td>' + escapeHtml(r.idStock) + '</td>';
      html += '<td><b>' + escapeHtml(r.namaBarang) + '</b><br><span class="small">IT: ' + escapeHtml(r.nomorITKirim || '-') + '</span></td>';
      html += '<td class="center"><b>' + escapeHtml(r.nomorBatch || '-') + '</b></td>';
      html += '<td class="center">' + escapeHtml(r.tanggalProduksi) + '</td>';
      html += '<td class="center">' + escapeHtml(r.tanggalExpired) + '</td>';
      html += '<td class="center">' + escapeHtml(r.status) + '</td>';
      html += '<td class="center">' + escapeHtml(r.lokasiRak) + '</td>';
      html += '<td class="center">' + bstbText + '</td>';
      html += '<td class="center">' + escapeHtml(r.namaUserInputTerakhir || '-') + '</td>';
      html += '<td class="num">' + escapeHtml(formatNumber(r.qtySystem || 0)) + '</td>';
      html += '<td class="center">' + escapeHtml(r.satuan) + '</td>';
      html += '<td class="center"><input class="op-actual" id="op_actual_' + idx + '" data-system="' + escapeHtml(r.qtySystem || 0) + '" type="text" inputmode="numeric" pattern="[0-9]*" onkeydown="return preventQtyDecimal(event)" oninput="normalizeQtyInput(this); updateStockOpnameRow(' + idx + ')"></td>';
      html += '<td class="num" id="op_selisih_' + idx + '"></td>';
      html += '<td class="center"><span id="op_status_' + idx + '" class="op-status">BELUM DICEK</span></td>';
      html += '<td></td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '<div class="op-sign">';
    html += '<div class="op-sign-box"><div>Dibuat Oleh</div><div>(________________)</div></div>';
    html += '<div class="op-sign-box"><div>Diperiksa Inventory</div><div>(________________)</div></div>';
    html += '<div class="op-sign-box"><div>Diketahui Supervisor</div><div>(________________)</div></div>';
    html += '</div>';
    html += '</div>';

    div.innerHTML = html;
  }

  function updateStockOpnameRow(idx) {
    var input = byId('op_actual_' + idx);
    var selisihCell = byId('op_selisih_' + idx);
    var statusCell = byId('op_status_' + idx);
    if (!input || !selisihCell || !statusCell) return;

    var actualText = String(input.value || '').trim();
    if (!actualText) {
      selisihCell.textContent = '';
      statusCell.textContent = 'BELUM DICEK';
      statusCell.className = 'op-status';
      return;
    }

    var qtySystem = Number(input.getAttribute('data-system') || 0);
    var qtyActual = Number(actualText || 0);
    var selisih = qtyActual - qtySystem;
    selisihCell.textContent = formatNumber(selisih);

    if (selisih === 0) {
      statusCell.textContent = 'SESUAI';
      statusCell.className = 'op-status ok';
    } else {
      statusCell.textContent = 'TIDAK SESUAI';
      statusCell.className = 'op-status ng';
    }
  }

  function printStockOpnameForm() {
    var div = byId('stockopname_print_area');
    if (!div || !div.innerHTML.trim()) {
      showMsg('msg_stockopname', 'Buat form stock opname terlebih dahulu.', false);
      return;
    }

    Array.prototype.forEach.call(div.querySelectorAll('.op-actual'), function(input) {
      var idx = String(input.id || '').replace('op_actual_', '');
      updateStockOpnameRow(idx);
    });

    document.body.classList.add('printing-stockopname');
    var cleanup = function() {
      document.body.classList.remove('printing-stockopname');
      window.onafterprint = null;
    };
    window.onafterprint = cleanup;
    setTimeout(function() {
      window.print();
      setTimeout(cleanup, 700);
    }, 120);
  }


  function loadMutasiReport() {
    var filter = { auth: getAuthPayload(), startDate: val('mut_startDate'), endDate: val('mut_endDate'), jenisMutasi: val('mut_jenisMutasi'), namaBarang: val('mut_namaBarang'), status: val('mut_status') };
    showMsg('msg_mutasi', 'Memuat data mutasi...', true);
    google.script.run.withSuccessHandler(function(rows) { showMsg('msg_mutasi', 'Data mutasi: ' + rows.length + ' baris.', true); renderMutasiTable(rows); }).withFailureHandler(function(err) { showMsg('msg_mutasi', err.message || err, false); }).getMutasiReport(filter);
  }

  function exportMutasiCsv() {
    var filter = { auth: getAuthPayload(), startDate: val('mut_startDate'), endDate: val('mut_endDate'), jenisMutasi: val('mut_jenisMutasi'), namaBarang: val('mut_namaBarang'), status: val('mut_status') };
    showMsg('msg_mutasi', 'Membuat CSV...', true);
    google.script.run.withSuccessHandler(function(res) { byId('msg_mutasi').style.display = 'block'; byId('msg_mutasi').className = 'msg ok'; byId('msg_mutasi').innerHTML = 'CSV dibuat: ' + escapeHtml(res.fileName) + ' (' + res.totalRows + ' baris)<br><a href="' + escapeHtml(res.url) + '" target="_blank">Buka / Download CSV</a>'; }).withFailureHandler(function(err) { showMsg('msg_mutasi', err.message || err, false); }).exportMutasiCsv(filter);
  }

  function renderMutasiTable(rows) {
    var div = byId('mutasi_table');
    if (!rows || !rows.length) { div.innerHTML = '<div class="empty">Data mutasi belum ada.</div>'; return; }
    var html = '<table><thead><tr><th>Tgl</th><th>Mutasi</th><th>Barang</th><th>Qty</th><th>Resto/Dokumen/PIC</th></tr></thead><tbody>';
    rows.slice(0, 200).forEach(function(r) { var qtyText = r.jenisMutasi === 'IN' ? '+' + r.qtyMasuk : r.jenisMutasi === 'OUT' ? '-' + r.qtyKeluar : '0'; html += '<tr><td>' + escapeHtml(r.tanggalTransaksi) + '<br><span class="small">' + escapeHtml(r.timestampInput) + '</span></td><td><span class="badge">' + escapeHtml(r.jenisMutasi) + '</span></td><td><b>' + escapeHtml(r.namaBarang) + '</b><br><span class="small">Rak: ' + escapeHtml(r.lokasiRak) + '</span></td><td><b>' + escapeHtml(qtyText) + '</b> ' + escapeHtml(r.satuan) + '</td><td><span class="small">Kode: ' + escapeHtml(r.kodeResto) + '<br>Resto: ' + escapeHtml(r.namaResto) + '<br>SJ: ' + escapeHtml(r.nomorSuratJalan) + '<br>PIC/User: ' + escapeHtml(r.namaUserTransaksi || r.shiftKoordinator || '-') + '</span></td></tr>'; });
    html += '</tbody></table>'; div.innerHTML = html;
  }


  function loadTimeMotionReport() {
    var filter = { auth: getAuthPayload(), startDate: val('tm_startDate'), endDate: val('tm_endDate'), tipe: val('tm_tipe') };
    showMsg('msg_timemotion', 'Memuat time motion study...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_timemotion', 'Data time motion: ' + (res.rows || []).length + ' baris.', true);
      renderTimeMotionReport(res);
    }).withFailureHandler(function(err) { showMsg('msg_timemotion', err.message || err, false); }).getTimeMotionReport(filter);
  }

  function renderTimeMotionReport(res) {
    res = res || { summary: {}, rows: [] };
    var summary = res.summary || {};
    text('tm_avg_in', formatNumber(summary.rataInMenit || 0));
    text('tm_avg_out', formatNumber(summary.rataOutMenit || 0));
    text('tm_total_measured', formatNumber((summary.totalInTerukur || 0) + (summary.totalOutTerukur || 0)));
    text('tm_pending', formatNumber(summary.belumTerukur || 0));

    var rows = res.rows || [];
    var div = byId('timemotion_table');
    if (!rows.length) {
      div.innerHTML = '<div class="empty">Belum ada data time motion sesuai filter.</div>';
      return;
    }

    var html = '<table><thead><tr><th>Jenis</th><th>Tanggal</th><th>Referensi</th><th>Objek</th><th>Waktu</th><th>Durasi</th><th>PIC/Team</th></tr></thead><tbody>';
    rows.slice(0, 300).forEach(function(r) {
      var cls = r.durasiMenit === '' ? 'warning' : 'success';
      var statusText = String(r.status || '');
      var durasiText = r.durasiMenit === ''
        ? (statusText.indexOf('CEK JAM') !== -1 ? 'Perlu koreksi jam' : 'Belum terukur')
        : r.durasiMenit + ' menit';
      html += '<tr>' +
        '<td><span class="badge ' + cls + '">' + escapeHtml(r.jenis) + '</span><br><span class="small">' + escapeHtml(r.status) + '</span></td>' +
        '<td>' + escapeHtml(r.tanggal) + '</td>' +
        '<td><b>' + escapeHtml(r.referensi) + '</b><br><span class="small">' + escapeHtml(r.detail) + '</span></td>' +
        '<td>' + escapeHtml(r.barangResto) + '<br><span class="small">Qty: ' + escapeHtml(r.qty) + ' ' + escapeHtml(r.satuan) + '<br>Lokasi/Nopol: ' + escapeHtml(r.lokasi) + '</span></td>' +
        '<td><span class="small">' + escapeHtml(r.startLabel || 'Start') + ': ' + escapeHtml(r.start) + '<br>' + escapeHtml(r.endLabel || 'Selesai') + ': ' + escapeHtml(r.selesai) + '</span></td>' +
        '<td><b>' + escapeHtml(durasiText) + '</b></td>' +
        '<td>' + escapeHtml(r.koordinatorTeam) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    if (rows.length > 300) html += '<div class="small">Menampilkan 300 baris pertama.</div>';
    div.innerHTML = html;
  }

  function loadStockReport() {
    var filter = { namaBarang: val('rep_namaBarang'), status: val('rep_status'), groupBy: val('rep_groupBy'), onlyAvailable: true };
    google.script.run.withSuccessHandler(function(res) { renderStockReport(res); }).withFailureHandler(function(err) { alert(err.message || err); }).getStockReport(filter);
  }

  function renderStockReport(res) { renderStockGroupTable(res.groups || []); renderStockDetailTable(res.details || []); }
  function renderStockGroupTable(rows) { var div = byId('report_group_table'); if (!rows.length) { div.innerHTML = '<div class="empty">Report group belum ada.</div>'; return; } var html = '<table><thead><tr><th>Group</th><th>Stock</th><th>Lot</th><th>Expired Terdekat</th></tr></thead><tbody>'; rows.forEach(function(r) { html += '<tr><td><b>' + escapeHtml(r.groupKey) + '</b><br><span class="small">Satuan: ' + escapeHtml(r.satuan) + '</span></td><td><b>' + escapeHtml(r.stockOnhand) + '</b><br><span class="small">Masuk: ' + escapeHtml(r.totalQtyMasuk) + ' | Keluar: ' + escapeHtml(r.totalQtyKeluar) + '</span></td><td>' + escapeHtml(r.totalLot) + '</td><td>' + escapeHtml(r.expiredTerdekat) + '</td></tr>'; }); html += '</tbody></table>'; div.innerHTML = html; }
  function renderStockDetailTable(rows) { var div = byId('report_detail_table'); if (!rows.length) { div.innerHTML = ''; return; } var html = '<table><thead><tr><th>Barang</th><th>Batch</th><th>Status</th><th>Rak</th><th>Stock</th><th>Expired</th></tr></thead><tbody>'; rows.forEach(function(r) { html += '<tr><td><b>' + escapeHtml(r.namaBarang) + '</b><br><span class="small">' + escapeHtml(r.idStock) + '<br>PIC/User: ' + escapeHtml(r.namaUserInputTerakhir || '-') + '</span></td><td><b>' + escapeHtml(r.nomorBatch || '-') + '</b></td><td><span class="badge">' + escapeHtml(r.status) + '</span></td><td>' + escapeHtml(r.lokasiRak) + '</td><td><b>' + escapeHtml(r.stockOnhand) + '</b> ' + escapeHtml(r.satuan) + '</td><td>' + escapeHtml(r.tanggalExpired) + '</td></tr>'; }); html += '</tbody></table>'; div.innerHTML = html; }

  function loadInboundOutboundReport() {
    var filter = {
      auth: getAuthPayload(),
      startDate: val('rep_io_startDate'),
      endDate: val('rep_io_endDate'),
      namaBarang: val('rep_io_namaBarang')
    };
    var table = byId('report_inout_table');
    var rangeTable = byId('report_inout_range_table');
    var daily = byId('report_inout_daily');
    if (rangeTable) rangeTable.innerHTML = '';
    if (daily) daily.innerHTML = '';
    if (table) table.innerHTML = '<div class="empty">Memuat report inbound/outbound...</div>';
    google.script.run
      .withSuccessHandler(function(res) { renderInboundOutboundReport(res); })
      .withFailureHandler(function(err) {
        if (table) table.innerHTML = '<div class="empty">Gagal memuat report inbound/outbound: ' + escapeHtml(err.message || err) + '</div>';
      })
      .getInboundOutboundItemReport(filter);
  }

  function renderInboundOutboundReport(res) {
    res = res || { summary: {}, rangeRows: [], dailyRows: [], rows: [] };
    var summary = res.summary || {};
    var rangeRows = res.rangeRows || [];
    var dailyRows = res.dailyRows || [];
    var rows = res.rows || [];
    var summaryDiv = byId('report_inout_summary');
    var rangeDiv = byId('report_inout_range_table');
    var dailyDiv = byId('report_inout_daily');
    var tableDiv = byId('report_inout_table');

    if (summaryDiv) {
      summaryDiv.innerHTML = '' +
        '<div class="summary-grid">' +
          '<div class="summary-card"><b>' + escapeHtml(formatNumber(summary.totalHari || 0)) + '</b><span>Total Hari</span></div>' +
          '<div class="summary-card"><b>' + escapeHtml(formatNumber(summary.totalInbound || 0)) + '</b><span>Total Inbound</span></div>' +
          '<div class="summary-card"><b>' + escapeHtml(formatNumber(summary.totalOutbound || 0)) + '</b><span>Total Outbound</span></div>' +
          '<div class="summary-card"><b>' + escapeHtml(formatNumber(summary.totalNet || 0)) + '</b><span>Net In-Out</span></div>' +
          '<div class="summary-card"><b>' + escapeHtml(formatNumber(summary.totalItemRange || 0)) + '</b><span>Item Range</span></div>' +
        '</div>' +
        '<div class="small"><b>Periode:</b> ' + escapeHtml(summary.periodeLabel || '-') + '. Sumber data: ' + escapeHtml(summary.sumberData || '-') + '. Transaksi IN: ' + escapeHtml(formatNumber(summary.inboundTransaksi || 0)) + ' | Transaksi OUT: ' + escapeHtml(formatNumber(summary.outboundTransaksi || 0)) + '</div>';
    }

    if (rangeDiv) {
      if (!rangeRows.length) {
        rangeDiv.innerHTML = '';
      } else {
        var rangeHtml = '<h4 style="margin:14px 0 6px;">Total Inbound / Outbound Per Item Berdasarkan Range Tanggal</h4>' +
          '<div class="small">Periode: <b>' + escapeHtml(summary.periodeLabel || '-') + '</b></div>' +
          '<div class="io-range-wrap"><table class="io-range-table"><thead><tr>' +
          '<th class="th-name">NAMA BARANG</th><th class="th-unit">SATUAN</th><th class="th-in">INBOUND</th><th class="th-out">OUTBOUND</th>' +
          '</tr></thead><tbody>';
        rangeRows.forEach(function(r) {
          rangeHtml += '<tr>' +
            '<td>' + escapeHtml(r.namaBarang || '-') + '</td>' +
            '<td>' + escapeHtml(r.satuan || '-') + '</td>' +
            '<td>' + escapeHtml(formatNumber(r.inbound || 0)) + '</td>' +
            '<td>' + escapeHtml(formatNumber(r.outbound || 0)) + '</td>' +
          '</tr>';
        });
        rangeHtml += '<tr class="total-row"><td>TOTAL</td><td></td><td>' + escapeHtml(formatNumber(summary.totalInbound || 0)) + '</td><td>' + escapeHtml(formatNumber(summary.totalOutbound || 0)) + '</td></tr>';
        rangeHtml += '</tbody></table></div>';
        rangeDiv.innerHTML = rangeHtml;
      }
    }

    if (dailyDiv) {
      if (!dailyRows.length) {
        dailyDiv.innerHTML = '';
      } else {
        var dailyHtml = '<h4 style="margin:14px 0 8px;">Ringkasan Total Per Hari</h4>' +
          '<table><thead><tr><th>Tanggal</th><th>Total Inbound</th><th>Total Outbound</th><th>Net</th><th>Total Item</th><th>Transaksi</th></tr></thead><tbody>';
        dailyRows.forEach(function(r) {
          var netClass = Number(r.net || 0) < 0 ? 'badge danger' : 'badge success';
          dailyHtml += '<tr>' +
            '<td><b>' + escapeHtml(r.tanggal) + '</b></td>' +
            '<td><b>' + escapeHtml(formatNumber(r.inbound || 0)) + '</b></td>' +
            '<td><b>' + escapeHtml(formatNumber(r.outbound || 0)) + '</b></td>' +
            '<td><span class="' + netClass + '">' + escapeHtml(formatNumber(r.net || 0)) + '</span></td>' +
            '<td>' + escapeHtml(formatNumber(r.totalItem || 0)) + '</td>' +
            '<td>' + escapeHtml(formatNumber(r.jumlahTransaksi || 0)) + '</td>' +
          '</tr>';
        });
        dailyHtml += '</tbody></table>';
        dailyDiv.innerHTML = dailyHtml;
      }
    }

    if (!tableDiv) return;
    if (!rows.length) {
      tableDiv.innerHTML = '<div class="empty">Belum ada data inbound/outbound pada filter tanggal yang dipilih.</div>';
      return;
    }

    var html = '<h4 style="margin:14px 0 8px;">Detail Qty Total Setiap Item Per Hari</h4>' +
      '<table><thead><tr><th>Tanggal</th><th>Nama Barang</th><th>Inbound</th><th>Outbound</th><th>Net</th><th>Transaksi</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      var netClass = Number(r.net || 0) < 0 ? 'badge danger' : 'badge success';
      html += '<tr>' +
        '<td>' + escapeHtml(r.tanggal) + '</td>' +
        '<td><b>' + escapeHtml(r.namaBarang) + '</b><br><span class="small">Satuan: ' + escapeHtml(r.satuan || '-') + '</span></td>' +
        '<td><b>' + escapeHtml(formatNumber(r.inbound || 0)) + '</b><br><span class="small">' + escapeHtml(formatNumber(r.jumlahTransaksiInbound || 0)) + ' transaksi IN</span></td>' +
        '<td><b>' + escapeHtml(formatNumber(r.outbound || 0)) + '</b><br><span class="small">' + escapeHtml(formatNumber(r.jumlahTransaksiOutbound || 0)) + ' transaksi OUT</span></td>' +
        '<td><span class="' + netClass + '">' + escapeHtml(formatNumber(r.net || 0)) + '</span></td>' +
        '<td>' + escapeHtml(formatNumber(r.jumlahTransaksi || 0)) + '</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
  }





  var stockImportCsvNeedsUpload = false;

  function loadStockImportTemplateInfo() {
    if (!currentUser || !currentUser.access || !currentUser.access.supervisor) return;
    google.script.run.withSuccessHandler(function(res) {
      renderStockImportResult(res);
    }).withFailureHandler(function(err) {
      showMsg('stock_import_msg', err.message || err, false);
    }).getStockImportTemplateInfo({ auth: getAuthPayload() });
  }

  function createStockImportTemplate() {
    showMsg('stock_import_msg', 'Membuat / memperbarui template...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('stock_import_msg', res.message || 'Template siap.', true);
      renderStockImportResult(res);
    }).withFailureHandler(function(err) {
      showMsg('stock_import_msg', err.message || err, false);
    }).createStockImportTemplate({ auth: getAuthPayload() });
  }

  function uploadStockImportCsv(afterUpload) {
    var input = byId('stock_import_csv');
    if (!input || !input.files || !input.files.length) {
      showMsg('stock_import_msg', 'Pilih file CSV terlebih dahulu.', false);
      return;
    }
    var file = input.files[0];
    var reader = new FileReader();
    showMsg('stock_import_msg', 'Membaca dan mengupload CSV ke sheet template...', true);
    reader.onload = function(e) {
      var csvText = e.target.result || '';
      google.script.run.withSuccessHandler(function(res) {
        stockImportCsvNeedsUpload = false;
        showMsg('stock_import_msg', res.message || 'CSV berhasil diupload.', !!(res && res.ok));
        renderStockImportResult(res);
        if (typeof afterUpload === 'function') afterUpload(res);
      }).withFailureHandler(function(err) {
        showMsg('stock_import_msg', err.message || err, false);
      }).uploadStockImportCsvToTemplate({ auth: getAuthPayload(), csvText: csvText });
    };
    reader.onerror = function() {
      showMsg('stock_import_msg', 'File CSV tidak bisa dibaca browser.', false);
    };
    reader.readAsText(file);
  }

  function validateStockImportTemplate(forceSheetOnly) {
    var input = byId('stock_import_csv');
    if (!forceSheetOnly && input && input.files && input.files.length && stockImportCsvNeedsUpload) {
      showMsg('stock_import_msg', 'File CSV terpilih. Sistem upload dulu ke sheet template, lalu validasi otomatis...', true);
      uploadStockImportCsv(function(uploadRes) {
        if (uploadRes && uploadRes.ok) validateStockImportTemplate(true);
      });
      return;
    }

    showMsg('stock_import_msg', 'Memvalidasi data template...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('stock_import_msg', res.message || 'Validasi selesai.', !!(res && res.ok));
      renderStockImportResult(res);
    }).withFailureHandler(function(err) {
      showMsg('stock_import_msg', err.message || err, false);
    }).validateStockImportTemplate({ auth: getAuthPayload() });
  }

  function importStockFromTemplate() {
    if (!confirm('Import stock akan menambah data ke BARANG_MASUK, STOCK_ONHAND, MUTASI_BARANG, dan LOG_IMPORT_STOCK. Lanjutkan?')) return;
    showMsg('stock_import_msg', 'Memproses import stock...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('stock_import_msg', res.message || 'Import selesai.', res.errorCount === 0);
      renderStockImportResult(res);
      if (res && res.ok) loadMasterData();
    }).withFailureHandler(function(err) {
      showMsg('stock_import_msg', err.message || err, false);
    }).importStockFromTemplate({ auth: getAuthPayload() });
  }

  function renderStockImportResult(res) {
    var el = byId('stock_import_result');
    if (!el || !res) return;

    var summary = '';
    if (typeof res.inputRows !== 'undefined') {
      summary += '<div class="summary-grid">';
      summary += '<div class="summary-card"><b>' + formatNumber(res.inputRows || 0) + '</b><span>Baris Template</span></div>';
      summary += '<div class="summary-card"><b>' + escapeHtml(res.sheetName || '-') + '</b><span>Sheet Template</span></div>';
      summary += '<div class="summary-card"><b>-</b><span>Valid</span></div>';
      summary += '<div class="summary-card"><b>-</b><span>Error</span></div>';
      summary += '</div>';
      summary += '<div class="empty">' + escapeHtml(res.message || '') + '</div>';
      el.innerHTML = summary;
      return;
    }

    var errorRows = res.errorRows || [];
    summary += '<div class="summary-grid">';
    summary += '<div class="summary-card"><b>' + formatNumber(res.totalRows || 0) + '</b><span>Total Baris</span></div>';
    summary += '<div class="summary-card"><b>' + formatNumber(res.validCount || 0) + '</b><span>Valid</span></div>';
    summary += '<div class="summary-card"><b>' + formatNumber(res.errorCount || 0) + '</b><span>Error</span></div>';
    summary += '<div class="summary-card"><b>' + formatNumber(res.importedCount || 0) + '</b><span>Imported</span></div>';
    summary += '</div>';

    if (res.importId) summary += '<div class="small"><b>ID Import:</b> ' + escapeHtml(res.importId) + '</div>';
    if (errorRows.length) summary += '<div class="msg err" style="display:block;"><b>Baris yang error:</b> ' + escapeHtml(errorRows.join(', ')) + '<br>Silakan cek kolom <b>Hasil Validasi</b> pada baris tersebut di sheet STOCK_IMPORT_TEMPLATE.</div>';
    if (res.message) summary += '<div class="small">' + escapeHtml(res.message) + '</div>';

    var rows = res.results || [];
    if (!rows.length) {
      el.innerHTML = summary + '<div class="empty">Tidak ada hasil baris untuk ditampilkan.</div>';
      return;
    }

    var displayRows = rows.slice();
    displayRows.sort(function(a, b) {
      var aErr = a.status === 'ERROR' ? 0 : 1;
      var bErr = b.status === 'ERROR' ? 0 : 1;
      if (aErr !== bErr) return aErr - bErr;
      return Number(a.rowNumber || 0) - Number(b.rowNumber || 0);
    });

    summary += '<table><thead><tr><th>Baris</th><th>Status</th><th>Pesan</th><th>ID Stock</th></tr></thead><tbody>';
    displayRows.slice(0, 100).forEach(function(row) {
      var badgeClass = row.status === 'ERROR' ? 'danger' : (row.status === 'IMPORTED' || row.status === 'VALID' ? 'success' : 'warning');
      var rowStyle = row.status === 'ERROR' ? ' style="background:#fee2e2;"' : '';
      summary += '<tr' + rowStyle + '>';
      summary += '<td><b>' + escapeHtml(row.rowNumber || '') + '</b></td>';
      summary += '<td><span class="badge ' + badgeClass + '">' + escapeHtml(row.status || '') + '</span></td>';
      summary += '<td>' + escapeHtml(row.message || '') + '</td>';
      summary += '<td>' + escapeHtml(row.idStock || '') + '</td>';
      summary += '</tr>';
    });
    summary += '</tbody></table>';
    if (rows.length > 100) summary += '<div class="small">Ditampilkan 100 baris pertama dengan prioritas baris ERROR. Total hasil: ' + formatNumber(rows.length) + '. Detail lengkap ada di kolom Hasil Validasi pada sheet template.</div>';
    el.innerHTML = summary;
  }


  function setDateTimeNow(inputId) {
    var el = byId(inputId);
    if (el) el.value = getDateTimeLocalValue(new Date());
  }

  function getDateTimeLocalValue(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + 'T' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function preventQtyDecimal(event) {
    var blockedKeys = ['.', ',', '-', '+', 'e', 'E'];
    if (blockedKeys.indexOf(event.key) !== -1) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  function normalizeQtyInput(el) {
    if (!el) return;
    var currentValue = String(el.value || '');
    var cleanedValue = currentValue.replace(/[^0-9]/g, '');

    // Jangan parseInt / Number di frontend.
    // Tujuannya agar angka yang sudah diketik user tidak berubah otomatis oleh browser.
    if (currentValue !== cleanedValue) {
      var cursorPos = el.selectionStart || cleanedValue.length;
      el.value = cleanedValue;
      try {
        var newPos = Math.max(0, cursorPos - (currentValue.length - cleanedValue.length));
        el.setSelectionRange(newPos, newPos);
      } catch (err) {}
    }
  }

  function isPositiveIntegerString(value) {
    return /^[0-9]+$/.test(String(value || '').trim()) && Number(value) > 0;
  }

  function normalizeMinuteSecondInput(el) {
    if (!el) return;
    var currentValue = String(el.value || '');
    var cleanedValue = currentValue.replace(/[^0-9:]/g, '');
    var firstColon = cleanedValue.indexOf(':');
    if (firstColon !== -1) {
      cleanedValue = cleanedValue.slice(0, firstColon + 1) + cleanedValue.slice(firstColon + 1).replace(/:/g, '');
      var parts = cleanedValue.split(':');
      cleanedValue = parts[0].slice(0, 4) + ':' + (parts[1] || '').slice(0, 2);
    } else {
      cleanedValue = cleanedValue.slice(0, 4);
    }
    if (currentValue !== cleanedValue) el.value = cleanedValue;
  }

  function normalizeMinuteSecondBlur(el) {
    if (!el) return;
    var raw = String(el.value || '').trim();
    if (!raw) return;
    if (/^[0-9]+$/.test(raw)) {
      el.value = String(Number(raw)) + ':00';
      return;
    }
    var match = raw.match(/^([0-9]+):([0-9]{1,2})$/);
    if (!match) return;
    var menit = Number(match[1]);
    var detik = Number(match[2]);
    if (detik >= 0 && detik <= 59) {
      el.value = String(menit) + ':' + String(detik).padStart(2, '0');
    }
  }

  function isMinuteSecondDurationString(value) {
    var raw = String(value || '').trim();
    if (!raw) return true;
    if (/^[0-9]+$/.test(raw)) return Number(raw) > 0;
    var match = raw.match(/^([0-9]+):([0-9]{1,2})$/);
    if (!match) return false;
    var menit = Number(match[1]);
    var detik = Number(match[2]);
    return detik >= 0 && detik <= 59 && (menit > 0 || detik > 0);
  }

  function formatMinuteSecondText(value) {
    var raw = String(value || '').trim();
    if (!raw) return '-';
    if (/^[0-9]+$/.test(raw)) return Number(raw) + ' menit';
    var match = raw.match(/^([0-9]+):([0-9]{1,2})$/);
    if (!match) return raw;
    var menit = Number(match[1]);
    var detik = Number(match[2]);
    if (detik === 0) return menit + ' menit';
    if (menit === 0) return detik + ' detik';
    return menit + ' menit ' + detik + ' detik';
  }


  var rackQrScanner = null;
  var rackQrIsRunning = false;
  var lastRackQrText = '';

  function canUseRackScanner() {
    return !!(currentUser && currentUser.access && (currentUser.access.supervisor || currentUser.access.rackQr || currentUser.access.scanBarcode));
  }

  function getRackScannerConfig() {
    if (typeof Html5QrcodeSupportedFormats === 'undefined') return {};
    var F = Html5QrcodeSupportedFormats;
    var formats = [
      F.QR_CODE, F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8,
      F.UPC_A, F.UPC_E, F.ITF, F.CODABAR, F.DATA_MATRIX
    ].filter(function(format) { return format !== undefined && format !== null; });
    return {
      formatsToSupport: formats,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    };
  }

  function startRackQrScanner() {
    if (!canUseRackScanner()) {
      showMsg('msg_rackqr', 'Menu scan QR/Barcode hanya untuk Supervisor dan Koordinator IN/OUT.', false);
      return;
    }

    if (typeof Html5Qrcode === 'undefined') {
      showMsg('msg_rackqr', 'Library scanner QR belum termuat. Gunakan Mode 1 Ambil Foto QR atau input manual nomor rak.', false);
      return;
    }

    var readerId = 'qr_reader';
    var reader = byId(readerId);
    if (!reader) return;

    if (rackQrIsRunning) {
      showMsg('msg_rackqr', 'Kamera live sudah berjalan.', true);
      return;
    }

    reader.innerHTML = '';
    rackQrScanner = rackQrScanner || new Html5Qrcode(readerId, getRackScannerConfig());

    showMsg('msg_rackqr', 'Meminta izin kamera live browser...', true);

    // Mode live scanner. Ini bisa gagal pada iframe Google walaupun izin browser sudah Allow.
    rackQrScanner.start(
      { facingMode: { ideal: 'environment' } },
      { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1.0 },
      function(decodedText) {
        handleRackQrDecoded(decodedText);
      },
      function() {}
    ).then(function() {
      rackQrIsRunning = true;
      showMsg('msg_rackqr', 'Kamera live aktif. Arahkan ke QR/barcode nomor rak.', true);
    }).catch(function(err) {
      rackQrIsRunning = false;
      var msg = String((err && err.message) ? err.message : err || '');

      showMsg(
        'msg_rackqr',
        'Kamera live tidak bisa dibuka: ' + msg + '. Gunakan Mode 1 Ambil Foto QR/Barcode, karena mode tersebut lebih stabil pada HP/laptop dan tidak bergantung stream kamera iframe.',
        false
      );
    });
  }

  function stopRackQrScanner() {
    stopRackQrScannerSilent();
    showMsg('msg_rackqr', 'Kamera live dihentikan.', true);
  }

  function stopRackQrScannerSilent() {
    if (rackQrScanner && rackQrIsRunning) {
      rackQrScanner.stop().then(function() {
        rackQrIsRunning = false;
      }).catch(function() {
        rackQrIsRunning = false;
      });
    }
  }

  function scanRackQrFromFile(input) {
    if (!canUseRackScanner()) {
      showMsg('msg_rackqr', 'Menu scan QR/Barcode hanya untuk Supervisor dan Koordinator IN/OUT.', false);
      return;
    }

    if (typeof Html5Qrcode === 'undefined') {
      showMsg('msg_rackqr', 'Library scanner QR belum termuat. Gunakan input manual nomor rak.', false);
      return;
    }

    var file = input && input.files && input.files[0];
    if (!file) return;

    stopRackQrScannerSilent();
    showMsg('msg_rackqr', 'Membaca QR/Barcode dari foto/gambar...', true);

    // Gunakan instance khusus yang tidak sedang start kamera.
    var scannerId = 'qr_reader';
    if (!byId(scannerId)) {
      showMsg('msg_rackqr', 'Area scanner tidak ditemukan. Gunakan input manual nomor rak.', false);
      return;
    }

    var imageScanner = rackQrScanner || new Html5Qrcode(scannerId, getRackScannerConfig());
    rackQrScanner = imageScanner;

    imageScanner.scanFile(file, true)
      .then(function(decodedText) {
        handleRackQrDecoded(decodedText);
        showMsg('msg_rackqr', 'QR/Barcode berhasil dibaca dari foto/gambar.', true);
        try { input.value = ''; } catch (err) {}
      })
      .catch(function(err) {
        showMsg('msg_rackqr', 'Gagal membaca QR/Barcode dari foto/gambar. Pastikan kode jelas, tidak blur, dan cukup terang. Detail: ' + err, false);
        try { input.value = ''; } catch (e) {}
      });
  }

  function handleRackQrDecoded(decodedText) {
    var text = String(decodedText || '').trim();
    if (!text) return;

    if (text === lastRackQrText) return;
    lastRackQrText = text;

    byId('qr_rak_text').value = text;
    loadRackQrStock(text);
  }

  function loadRackQrStockByText() {
    var text = val('qr_rak_text');
    if (!text) {
      showMsg('msg_rackqr', 'Isi atau scan nomor rak terlebih dahulu.', false);
      return;
    }
    loadRackQrStock(text);
  }

  function loadRackQrStock(text) {
    showMsg('msg_rackqr', 'Membaca stock rak...', true);
    google.script.run.withSuccessHandler(function(res) {
      showMsg('msg_rackqr', 'Data rak berhasil dibaca: ' + res.lokasiRak, true);
      renderRackQrResult(res);
    }).withFailureHandler(function(err) {
      showMsg('msg_rackqr', err.message || err, false);
      byId('qr_rack_result').innerHTML = '';
    }).getRackStockDetailByQr({
      qrText: text,
      auth: getAuthPayload()
    });
  }

  function renderRackQrResult(res) {
    var div = byId('qr_rack_result');
    if (!div) return;

    var html = '<div class="qr-result-header">' +
      '<div class="qr-summary-card"><span class="small">Nomor Rak</span><b>' + escapeHtml(res.lokasiRak) + '</b></div>' +
      '<div class="qr-summary-card"><span class="small">Total Lot</span><b>' + escapeHtml(res.totalItem) + '</b></div>' +
      '<div class="qr-summary-card"><span class="small">Total Qty</span><b>' + escapeHtml(res.totalQty) + '</b></div>' +
      '</div>';

    if (!res.rows || !res.rows.length) {
      html += '<div class="empty">Rak ' + escapeHtml(res.lokasiRak) + ' kosong atau tidak ada stock onhand.</div>';
      div.innerHTML = html;
      return;
    }

    html += '<table><thead><tr>' +
      '<th>Deskripsi Nama Item</th>' +
      '<th>Jumlah Item</th>' +
      '<th>Tanggal Produksi</th>' +
      '<th>Tanggal Expired</th>' +
      '<th>Status</th>' +
      '<th>Last Update Stock</th>' +
      '</tr></thead><tbody>';

    res.rows.forEach(function(row) {
      html += '<tr>' +
        '<td><b>' + escapeHtml(row.namaBarang) + '</b><br><span class="small">ID: ' + escapeHtml(row.idStock) + '<br>BSTB: ' + escapeHtml(row.nomorBSTB) + '</span></td>' +
        '<td><b>' + escapeHtml(row.jumlahItem) + '</b> ' + escapeHtml(row.satuan) + '</td>' +
        '<td>' + escapeHtml(row.tanggalProduksi) + '</td>' +
        '<td>' + escapeHtml(row.tanggalExpired) + '</td>' +
        '<td><span class="badge">' + escapeHtml(row.status) + '</span></td>' +
        '<td>' + escapeHtml(row.lastUpdateStock || '-') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    div.innerHTML = html;
  }

  function daysToExpired(dateText) { if (!dateText) return 99999; var today = new Date(); today.setHours(0,0,0,0); var d = new Date(dateText); if (isNaN(d.getTime())) return 99999; d.setHours(0,0,0,0); return Math.ceil((d.getTime() - today.getTime()) / 86400000); }
  function formatTanggalAlert(dateValue) {
    if (!dateValue) return '-';
    var parts = String(dateValue).split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return String(dateValue);
  }
  function formatNumber(n) { return Number(n || 0).toLocaleString('id-ID'); }
  function byId(id) { return document.getElementById(id); }
  function val(id) { var el = byId(id); return el ? el.value.trim() : ''; }
  function text(id, value) { var el = byId(id); if (el) el.textContent = value; }
  function showMsg(id, text, ok) { var el = byId(id); if (!el) return; el.style.display = 'block'; el.className = 'msg ' + (ok ? 'ok' : 'err'); el.textContent = text; }
  function isOtdrDoneClient(status) { var key = String(status || '').toUpperCase().trim(); return key === 'LENGKAP' || key === 'LOADING LENGKAP' || key === 'COMPLETE'; }
  function escapeHtml(text) { return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function escapeAttr(text) { return escapeHtml(text).replace(/\`/g, '&#096;'); }
  function escapeJs(text) { return String(text || '').replace(/\\\\/g, '').replace(/'/g, '').replace(/[\\r\\n]/g, ' '); }
</script>
</body>
</html>
`;
}
