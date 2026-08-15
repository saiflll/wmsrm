import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './admin/users/user.entity';
import { Customer } from './master/customers/customer.entity';
import { Gudang, GudangType } from './master/gudang/gudang.entity';
import { Barang, KategoriBarang } from './master/barang/barang.entity';
import { Suplayer } from './master/suplayers/suplayer.entity';
import { Shift } from './master/shifts/shift.entity';
import { Transaksi, TransaksiModel } from './transaksi/transaksi.entity';
import { Stock } from './management/inventory/stock.entity';
import { StockLog, LogType } from './management/inventory/stock-log.entity';
import { PlanningAyam } from './ayam/planning-ayam/planning-ayam.entity';
import { OutboundAyam } from './ayam/outbound-ayam/outbound-ayam.entity';
import { InboundPlanning } from './inbound/inbound-planning/inbound-planning.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private user_repo: Repository<User>,
    @InjectRepository(Customer) private customer_repo: Repository<Customer>,
    @InjectRepository(Gudang) private gudang_repo: Repository<Gudang>,
    @InjectRepository(Barang) private barang_repo: Repository<Barang>,
    @InjectRepository(Suplayer) private suplayer_repo: Repository<Suplayer>,
    @InjectRepository(Shift) private shift_repo: Repository<Shift>,
    @InjectRepository(Transaksi) private transaksi_repo: Repository<Transaksi>,
    @InjectRepository(Stock) private stock_repo: Repository<Stock>,
    @InjectRepository(StockLog) private stock_log_repo: Repository<StockLog>,
    @InjectRepository(PlanningAyam)
    private planning_ayam_repo: Repository<PlanningAyam>,
    @InjectRepository(OutboundAyam)
    private outbound_ayam_repo: Repository<OutboundAyam>,
    @InjectRepository(InboundPlanning)
    private inbound_planning_repo: Repository<InboundPlanning>,
  ) {}

  async onApplicationBootstrap() {
    await this.seed_users();
    const shifts = await this.seed_shifts();
    const barangs = await this.seed_barang();
    const gudangs = await this.seed_gudang(barangs);
    const suplayers = await this.seed_suplayer();
    await this.seed_customer();
    const users = await this.user_repo.find();
    await this.seed_transaksi(barangs, suplayers, gudangs, shifts, users);
    await this.seed_stock(barangs, gudangs);
    await this.seed_stock_log(barangs, gudangs, shifts, users);
    await this.seed_planning_ayam(barangs, shifts);
    const plannings = await this.planning_ayam_repo.find({
      relations: ['barang', 'shift'],
    });
    await this.seed_outbound_ayam(plannings, shifts);
    await this.seed_inbound_planning();
    console.log('🌱 All seed data inserted successfully!');
  }

  // ── Helpers ──────────────────────────────────────────
  private pick_random<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private random_date(days_back: number, days_forward: number = 0): Date {
    const d = new Date();
    d.setDate(
      d.getDate() -
        Math.floor(Math.random() * days_back) +
        Math.floor(Math.random() * days_forward),
    );
    return d;
  }

  private random_time(): string {
    const h = String(Math.floor(Math.random() * 14) + 6).padStart(2, '0'); // 06-19
    const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    const s = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private random_phone(): string {
    const prefixes = [
      '0812',
      '0813',
      '0856',
      '0857',
      '0878',
      '0821',
      '0822',
      '0815',
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    let num = '';
    for (let i = 0; i < 8; i++) num += Math.floor(Math.random() * 10);
    return prefix + num;
  }

  private random_nopol(): string {
    const letters = ['B', 'D', 'L', 'AG', 'N', 'W', 'H', 'AA', 'T', 'DK'];
    const l = letters[Math.floor(Math.random() * letters.length)];
    const num = 1000 + Math.floor(Math.random() * 9000);
    const tail =
      String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
      String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `${l} ${num} ${tail}`;
  }

  private id(x: number): number {
    return x;
  }

  // ── Users (existing logic kept) ──────────────────────
  private async seed_users() {
    const has_users = (await this.user_repo.count()) > 0;
    if (!has_users) {
      const users = [
        {
          username: 'checker',
          pass: await bcrypt.hash('checker123', 10),
          role: UserRole.CHECKER,
        },
        {
          username: 'admin',
          pass: await bcrypt.hash('admin123', 10),
          role: UserRole.ADMIN,
        },
        {
          username: 'koordinator',
          pass: await bcrypt.hash('koord123', 10),
          role: UserRole.KOORDINATOR,
        },
        {
          username: 'supervisor',
          pass: await bcrypt.hash('super123', 10),
          role: UserRole.SUPERVISOR,
        },
        {
          username: 'superadmin',
          pass: await bcrypt.hash('super123', 10),
          role: UserRole.SUPER_ADMIN,
        },
        {
          username: 'manager',
          pass: await bcrypt.hash('manager123', 10),
          role: UserRole.MANAGER,
        },
      ];
      await this.user_repo.save(this.user_repo.create(users));
      console.log('✅ Seed users (6 rows)');
    } else {
      const superadmin_exists = await this.user_repo.findOne({
        where: { username: 'superadmin' },
      });
      if (!superadmin_exists) {
        const sa = this.user_repo.create({
          username: 'superadmin',
          pass: await bcrypt.hash('super123', 10),
          role: UserRole.SUPER_ADMIN,
        });
        await this.user_repo.save(sa);
        console.log('✅ Added missing superadmin user');
      }
    }
  }

  // ── Shifts ───────────────────────────────────────────
  private async seed_shifts(): Promise<Shift[]> {
    const count = await this.shift_repo.count();
    if (count > 0) {
      console.log('⏭️  Shifts already seeded');
      return this.shift_repo.find();
    }
    const shifts = this.shift_repo.create([
      { name: 'Pagi' },
      { name: 'Siang' },
      { name: 'Malam' },
    ]);
    await this.shift_repo.save(shifts);
    console.log('✅ Seed shifts (3 rows)');
    return shifts;
  }

  // ── Barang (28 rows) ────────────────────────────────
  private async seed_barang(): Promise<Barang[]> {
    const count = await this.barang_repo.count();
    if (count > 0) {
      console.log('⏭️  Barang already seeded');
      return this.barang_repo.find();
    }
    const data: Partial<Barang>[] = [
      {
        sku: 'AB-001',
        nama: 'Ayam Broiler Beku 1Kg',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Ekor',
        faktor_konversi: 1.0,
        stok: 500,
        min_stok: 50,
        max_stok: 2000,
      },
      {
        sku: 'AK-001',
        nama: 'Ayam Kampung Beku',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Ekor',
        faktor_konversi: 1.0,
        stok: 200,
        min_stok: 20,
        max_stok: 800,
      },
      {
        sku: 'DAF-001',
        nama: 'Daging Ayam Fillet 500g',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 0.5,
        stok: 350,
        min_stok: 30,
        max_stok: 1200,
      },
      {
        sku: 'DS-001',
        nama: 'Daging Sapi Segar 1Kg',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 180,
        min_stok: 15,
        max_stok: 600,
      },
      {
        sku: 'DK-001',
        nama: 'Daging Kambing Beku',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 80,
        min_stok: 10,
        max_stok: 300,
      },
      {
        sku: 'IK-001',
        nama: 'Ikan Salmon Beku Fillet',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 120,
        min_stok: 15,
        max_stok: 500,
      },
      {
        sku: 'UV-001',
        nama: 'Udang Vannamei Beku 500g',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 0.5,
        stok: 220,
        min_stok: 25,
        max_stok: 800,
      },
      {
        sku: 'CC-001',
        nama: 'Cumi-cumi Beku 1Kg',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 95,
        min_stok: 10,
        max_stok: 400,
      },
      {
        sku: 'KR-001',
        nama: 'Kepiting Rajungan Beku',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 60,
        min_stok: 5,
        max_stok: 250,
      },
      {
        sku: 'IB-001',
        nama: 'Ikan Bandeng Segar',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Ekor',
        faktor_konversi: 0.5,
        stok: 150,
        min_stok: 15,
        max_stok: 600,
      },
      {
        sku: 'IL-001',
        nama: 'Ikan Lele Segar',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Ekor',
        faktor_konversi: 0.3,
        stok: 100,
        min_stok: 10,
        max_stok: 400,
      },
      {
        sku: 'KG-001',
        nama: 'Ikan Kembung Segar',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 130,
        min_stok: 15,
        max_stok: 500,
      },
      {
        sku: 'TAN-001',
        nama: 'Telur Ayam Negeri 1Kg',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        satuan_kecil: 'Butir',
        faktor_konversi: 0.06,
        stok: 800,
        min_stok: 100,
        max_stok: 5000,
      },
      {
        sku: 'BRS-001',
        nama: 'Beras Premium 5Kg',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 5.0,
        stok: 2000,
        min_stok: 200,
        max_stok: 8000,
      },
      {
        sku: 'GP-001',
        nama: 'Gula Pasir 1Kg',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 1.0,
        stok: 600,
        min_stok: 50,
        max_stok: 3000,
      },
      {
        sku: 'TT-001',
        nama: 'Tepung Terigu Segitiga 1Kg',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 1.0,
        stok: 450,
        min_stok: 40,
        max_stok: 2000,
      },
      {
        sku: 'MG-001',
        nama: 'Minyak Goreng Bimoli 5L',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Liter',
        satuan_kecil: 'Pcs',
        faktor_konversi: 5.0,
        stok: 380,
        min_stok: 30,
        max_stok: 1500,
      },
      {
        sku: 'BMR-001',
        nama: 'Bawang Merah Brebes',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 170,
        min_stok: 20,
        max_stok: 700,
      },
      {
        sku: 'BPT-001',
        nama: 'Bawang Putih Kating',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 140,
        min_stok: 15,
        max_stok: 600,
      },
      {
        sku: 'CMB-001',
        nama: 'Cabai Merah Besar',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 90,
        min_stok: 10,
        max_stok: 350,
      },
      {
        sku: 'KNT-001',
        nama: 'Kentang Dieng 1Kg',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 210,
        min_stok: 25,
        max_stok: 900,
      },
      {
        sku: 'WRT-001',
        nama: 'Wortel Fresh 1Kg',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Kg',
        faktor_konversi: 1.0,
        stok: 160,
        min_stok: 20,
        max_stok: 700,
      },
      {
        sku: 'TMP-001',
        nama: 'Tempe Kedelai Fresh',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Pcs',
        faktor_konversi: 1.0,
        stok: 300,
        min_stok: 30,
        max_stok: 1200,
      },
      {
        sku: 'THU-001',
        nama: 'Tahu Putih Fresh',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Pcs',
        faktor_konversi: 1.0,
        stok: 400,
        min_stok: 50,
        max_stok: 1500,
      },
      {
        sku: 'SA-001',
        nama: 'Sosis Ayam Champ 500g',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 0.5,
        stok: 250,
        min_stok: 25,
        max_stok: 1000,
      },
      {
        sku: 'NA-001',
        nama: 'Nugget Ayam Fiesta 500g',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 0.5,
        stok: 280,
        min_stok: 25,
        max_stok: 1000,
      },
      {
        sku: 'BS-001',
        nama: 'Bakso Sapi Kemasan 500g',
        kategori: KategoriBarang.WET,
        side: false,
        satuan: 'Kg',
        satuan_kecil: 'Pack',
        faktor_konversi: 0.5,
        stok: 190,
        min_stok: 20,
        max_stok: 800,
      },
      {
        sku: 'SC-001',
        nama: 'Sarden Kaleng 425g',
        kategori: KategoriBarang.DRY,
        side: true,
        satuan: 'Pcs',
        faktor_konversi: 1.0,
        stok: 550,
        min_stok: 50,
        max_stok: 3000,
      },
    ];
    const saved = await this.barang_repo.save(this.barang_repo.create(data));
    console.log(`✅ Seed barang (${saved.length} rows)`);
    return saved;
  }

  // ── Gudang (28 rows) ─────────────────────────────────
  private async seed_gudang(barangs: Barang[]): Promise<Gudang[]> {
    const count = await this.gudang_repo.count();
    if (count > 0) {
      console.log('⏭️  Gudang already seeded');
      return this.gudang_repo.find();
    }
    const racks: Partial<Gudang>[] = [];
    const zones = [
      { zone: 'CS FROZEN', side: false, count: 7, rows: ['A', 'B', 'C'] },
      { zone: 'CHILL', side: false, count: 6, rows: ['A', 'B'] },
      { zone: 'DRY A', side: true, count: 6, rows: ['A', 'B'] },
      { zone: 'DRY B', side: true, count: 5, rows: ['C', 'D'] },
      { zone: 'WET A', side: false, count: 4, rows: ['A'] },
    ];

    let global_idx = 0;
    for (const z of zones) {
      for (const row of z.rows) {
        for (let col = 1; col <= Math.ceil(z.count / z.rows.length); col++) {
          for (let lvl = 1; lvl <= 3; lvl++) {
            const name = `${row}${(col - 1) * 3 + lvl}`;
            const type =
              lvl <= 2 ? GudangType.SINGLE_DEEP : GudangType.DOUBLE_DEEP;
            const assign_barang =
              global_idx % 3 === 0 && barangs.length > 0
                ? barangs[global_idx % barangs.length]
                : null;
            racks.push({
              side: z.side,
              name,
              zone: z.zone,
              type,
              status: true,
              level: lvl,
              kolom: row,
              capacity: 500 + Math.floor(Math.random() * 1500),
              barang: assign_barang as any,
            });
            global_idx++;
            if (racks.length >= 28) break;
          }
          if (racks.length >= 28) break;
        }
        if (racks.length >= 28) break;
      }
      if (racks.length >= 28) break;
    }

    const saved = await this.gudang_repo.save(this.gudang_repo.create(racks));
    console.log(`✅ Seed gudang (${saved.length} rows)`);
    return saved;
  }

  // ── Suplayer (28 rows) ───────────────────────────────
  private async seed_suplayer(): Promise<Suplayer[]> {
    const count = await this.suplayer_repo.count();
    if (count > 0) {
      console.log('⏭️  Suplayer already seeded');
      return this.suplayer_repo.find();
    }
    const data: Partial<Suplayer>[] = [
      {
        name: 'PT. Pangan Nusantara',
        alamat: 'Jl. Raya Industri No.12, Cikarang, Bekasi',
        telp: this.random_phone(),
      },
      {
        name: 'UD. Berkah Jaya',
        alamat: 'Jl. Ahmad Yani No.45, Semarang',
        telp: this.random_phone(),
      },
      {
        name: 'CV. Makmur Sentosa',
        alamat: 'Jl. Pahlawan No.78, Surabaya',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Sumber Protein Indonesia',
        alamat: 'Jl. Gatot Subroto No.200, Bandung',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Agro Makmur Sejahtera',
        alamat: 'Jl. Raya Bogor KM 45, Cibinong, Bogor',
        telp: this.random_phone(),
      },
      {
        name: 'CV. Tani Jaya Abadi',
        alamat: 'Jl. Diponegoro No.33, Malang',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Hasil Laut Nusantara',
        alamat: 'Jl. Pelabuhan No.5, Tanjung Priok, Jakarta Utara',
        telp: this.random_phone(),
      },
      {
        name: 'UD. Sari Bumi',
        alamat: 'Jl. Raya Solo No.88, Karanganyar',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Indo Fresh Food',
        alamat: 'Jl. Industri Raya No.55, Tangerang',
        telp: this.random_phone(),
      },
      {
        name: 'CV. Mitra Ternak Lestari',
        alamat: 'Jl. Raya Parung No.120, Bogor',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Prima Daging Nusantara',
        alamat: 'Jl. Pemuda No.67, Bekasi',
        telp: this.random_phone(),
      },
      {
        name: 'UD. Lancar Jaya',
        alamat: 'Jl. Merdeka No.23, Yogyakarta',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Cold Storage Indonesia',
        alamat: 'Jl. Raya Serang KM 25, Balaraja, Tangerang',
        telp: this.random_phone(),
      },
      {
        name: 'CV. Bahari Nusantara',
        alamat: 'Jl. Tambak Lorok No.14, Semarang',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Telur Nusantara',
        alamat: 'Jl. Raya Blitar No.90, Blitar',
        telp: this.random_phone(),
      },
      {
        name: 'UD. Subur Makmur',
        alamat: 'Jl. Sudirman No.155, Tegal',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Sentra Pangan Indonesia',
        alamat: 'Jl. Raya Cileungsi No.88, Bogor',
        telp: this.random_phone(),
      },
      {
        name: 'CV. Bina Tani Mandiri',
        alamat: 'Jl. Veteran No.42, Kediri',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Indomarco Pangan',
        alamat: 'Jl. Ancol Barat No.10, Jakarta Utara',
        telp: this.random_phone(),
      },
      {
        name: 'UD. Sumber Rejeki',
        alamat: 'Jl. Gajah Mada No.77, Denpasar',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Rasa Nusantara Food',
        alamat: 'Jl. Raya Cikupa No.33, Tangerang',
        telp: this.random_phone(),
      },
      {
        name: 'CV. Wahana Pangan',
        alamat: 'Jl. Kaligawe No.50, Semarang',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Multi Guna Pangan',
        alamat: 'Jl. Raya Darmo No.200, Surabaya',
        telp: this.random_phone(),
      },
      {
        name: 'UD. Barokah Tani',
        alamat: 'Jl. Raya Magelang No.112, Magelang',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Surya Pangan Lestari',
        alamat: 'Jl. Margomulyo No.44, Surabaya',
        telp: this.random_phone(),
      },
      {
        name: 'CV. Agro Niaga Perkasa',
        alamat: 'Jl. Raya Purwakarta No.78, Purwakarta',
        telp: this.random_phone(),
      },
      {
        name: 'PT. Nutrifood Indonesia',
        alamat: 'Jl. Raya Bogor KM 35, Cimanggis, Depok',
        telp: this.random_phone(),
      },
      {
        name: 'UD. Harapan Baru',
        alamat: 'Jl. Imam Bonjol No.21, Jember',
        telp: this.random_phone(),
      },
    ];
    const saved = await this.suplayer_repo.save(this.suplayer_repo.create(data));
    console.log(`✅ Seed suplayer (${saved.length} rows)`);
    return saved;
  }

  // ── Customer (28 rows) ──────────────────────────────
  private async seed_customer(): Promise<Customer[]> {
    const count = await this.customer_repo.count();
    if (count > 0) {
      console.log('⏭️  Customer already seeded');
      return this.customer_repo.find();
    }
    const data: Partial<Customer>[] = [
      {
        nama: 'PT. Sumber Pangan',
        alamat: 'Jl. Mawar No.10, Jakarta Pusat',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Berkah Jaya',
        alamat: 'Jl. Melati No.22, Bandung',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Makmur Sentosa',
        alamat: 'Jl. Samarinda No.15, Surabaya',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Resto Indonesia Group',
        alamat: 'Jl. Sudirman No.99, Jakarta Selatan',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Sari Laut',
        alamat: 'Jl. Pantai Indah No.8, Semarang',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Nusa Food',
        alamat: 'Jl. Diponegoro No.55, Denpasar',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Fast Food Nusantara',
        alamat: 'Jl. Gatot Subroto No.120, Medan',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Dapur Sehat',
        alamat: 'Jl. AH Nasution No.77, Bandung',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Anugerah Catering',
        alamat: 'Jl. Pemuda No.33, Yogyakarta',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Hotel Santika Group',
        alamat: 'Jl. Thamrin No.88, Jakarta Pusat',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Warung Nusantara',
        alamat: 'Jl. Kenanga No.14, Malang',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Boga Jaya',
        alamat: 'Jl. Raya Serang No.65, Tangerang',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Gizi Prima Indonesia',
        alamat: 'Jl. Industri No.40, Bekasi',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Sumber Rezeki',
        alamat: 'Jl. Kawi No.19, Malang',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Sentral Logistik',
        alamat: 'Jl. Raya Bogor No.85, Cibinong',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Ayam Geprek Indonesia',
        alamat: 'Jl. Soekarno Hatta No.55, Bandung',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Seafood Express',
        alamat: 'Jl. Jimbaran No.12, Badung',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Mitra Bisnis Pangan',
        alamat: 'Jl. Cik Ditiro No.18, Yogyakarta',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Indo Catering Service',
        alamat: 'Jl. Rasuna Said No.77, Jakarta Selatan',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Bina Pangan Jaya',
        alamat: 'Jl. Veteran No.44, Semarang',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Kuliner Nusantara',
        alamat: 'Jl. Merdeka No.101, Bogor',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Frozen Food Indo',
        alamat: 'Jl. Raya Cikarang No.200, Bekasi',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Mart Sejahtera',
        alamat: 'Jl. Ahmad Yani No.35, Palembang',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Rumah Makan Padang Jaya',
        alamat: 'Jl. Margonda No.150, Depok',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Food Service Indonesia',
        alamat: 'Jl. Casablanca No.22, Jakarta Selatan',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'UD. Lentera Pangan',
        alamat: 'Jl. Raya Kuta No.67, Badung',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'CV. Sarana Pangan Abadi',
        alamat: 'Jl. Cempaka Putih No.30, Jakarta Pusat',
        telp: this.random_phone(),
        tipe: 'customer',
      },
      {
        nama: 'PT. Deli Food Indonesia',
        alamat: 'Jl. Mangga Dua No.11, Jakarta Utara',
        telp: this.random_phone(),
        tipe: 'customer',
      },
    ];
    const saved = await this.customer_repo.save(this.customer_repo.create(data));
    console.log(`✅ Seed customer (${saved.length} rows)`);
    return saved;
  }

  // ── Transaksi (26 rows) ─────────────────────────────
  private async seed_transaksi(
    barangs: Barang[],
    suplayers: Suplayer[],
    gudangs: Gudang[],
    shifts: Shift[],
    users: User[],
  ) {
    const count = await this.transaksi_repo.count();
    if (count > 0) {
      console.log('⏭️  Transaksi already seeded');
      return;
    }
    const notes = [
      'Barang masuk dari supplier reguler',
      'Pengiriman ekspres - butuh penanganan cepat',
      'Stok tambahan untuk promo akhir bulan',
      'Restock rutin mingguan',
      'Barang reject - pengembalian ke supplier',
      'Outbound ke customer prioritas',
      'Pengiriman partial - sisanya menyusul',
      'Barang basah - segera masuk cold storage',
      'Bongkar muat shift malam',
      'Penambahan stok gudang dry',
      'Pesanan khusus customer VIP',
      'Outbound terjadwal sore',
      'Stok titipan supplier',
      'Penyesuaian stok opname',
      'Barang cepat kadaluarsa',
      'Pengiriman menggunakan mobil box',
      'Barang sample untuk testing',
      'Stok cadangan lebaran',
      'Outbound ke cabang Surabaya',
      'Outbound ke cabang Bandung',
      'Barang frozen - suhu -18C',
      'Inbound dari supplier baru',
      'Retur sebagian barang',
      'Pengiriman normal',
      'Outbound mendesak - stok menipis',
      'Supply untuk event catering',
    ];
    const data: Partial<Transaksi>[] = [];
    for (let i = 0; i < 26; i++) {
      const is_out = i >= 16; // first 16 IN, last 10 OUT
      data.push({
        jumlah: 10 + Math.floor(Math.random() * 200),
        barang: barangs[i % barangs.length],
        suplayer: suplayers[i % suplayers.length],
        gudang: gudangs[i % gudangs.length],
        shift: this.pick_random(shifts),
        user: this.pick_random(users),
        datein: undefined as any, // auto CreateDateColumn
        exp: is_out ? undefined : this.random_date(0, 180), // future expiry
        jam_datang: this.random_time(),
        jam_bongkar: this.random_time(),
        jam_selesai: this.random_time(),
        note: notes[i % notes.length],
        model: is_out ? TransaksiModel.OUT : TransaksiModel.IN,
      });
    }
    const saved = await this.transaksi_repo.save(
      this.transaksi_repo.create(data),
    );
    console.log(`✅ Seed transaksi (${saved.length} rows)`);
  }

  // ── Stock (25 rows) ─────────────────────────────────
  private async seed_stock(barangs: Barang[], gudangs: Gudang[]) {
    const count = await this.stock_repo.count();
    if (count > 0) {
      console.log('⏭️  Stock already seeded');
      return;
    }
    const data: Partial<Stock>[] = [];
    for (let i = 0; i < 25; i++) {
      const b = barangs[i % barangs.length];
      const g = gudangs[i % gudangs.length];
      const batch_no = `BATCH-${String(i + 1).padStart(3, '0')}`;
      data.push({
        barang: b,
        gudang: g,
        batch_no: batch_no,
        lot_no: `LOT-${Math.floor(Math.random() * 900) + 100}`,
        qty: 20 + Math.floor(Math.random() * 300),
        reserved_qty: Math.random() > 0.6 ? Math.floor(Math.random() * 30) : 0,
        expiry_date: this.random_date(0, 365),
        satuan: b.satuan,
      });
    }
    const saved = await this.stock_repo.save(this.stock_repo.create(data));
    console.log(`✅ Seed stock (${saved.length} rows)`);
  }

  // ── StockLog (26 rows) ──────────────────────────────
  private async seed_stock_log(
    barangs: Barang[],
    gudangs: Gudang[],
    shifts: Shift[],
    users: User[],
  ) {
    const count = await this.stock_log_repo.count();
    if (count > 0) {
      console.log('⏭️  StockLog already seeded');
      return;
    }
    const log_types = [
      LogType.INBOUND,
      LogType.OUTBOUND,
      LogType.RELOCATION,
      LogType.ADJUST,
      LogType.OPNAME,
      LogType.PICKING,
    ];
    const statuses = ['RESERVED', 'CONFIRMED', 'COMPLETED'];
    const suppliers = [
      'PT. Pangan Nusantara',
      'UD. Berkah Jaya',
      'CV. Makmur Sentosa',
      'PT. Sumber Protein Indonesia',
    ];
    const notes = [
      'Log aktivitas gudang',
      'Penyesuaian stok',
      'Picking selesai',
      'Relokasi antar rak',
      'Stok opname fisik',
      'Barang inbound baru',
      'Outbound konfirmasi',
      'Adjust stok minus',
    ];

    const data: Partial<StockLog>[] = [];
    for (let i = 0; i < 26; i++) {
      const log_type = this.pick_random(log_types);
      const b = barangs[i % barangs.length];
      const g = gudangs[i % gudangs.length];
      const g2 = gudangs[(i + 3) % gudangs.length];
      const is_relocation = log_type === LogType.RELOCATION;
      const is_picking = log_type === LogType.PICKING;
      data.push({
        type: log_type,
        no_po: `PO-${String(i + 1).padStart(4, '0')}`,
        no_ref: `REF-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        barang: b,
        gudang: g,
        gudang_tujuan: is_relocation ? g2 : undefined,
        qty: 5 + Math.floor(Math.random() * 150),
        satuan: b.satuan,
        batch_no: `BATCH-${String((i % 25) + 1).padStart(3, '0')}`,
        lot_no: `LOT-${Math.floor(Math.random() * 900) + 100}`,
        expiry_date: this.random_date(0, 180),
        supplier: this.pick_random(suppliers),
        tujuan: is_picking
          ? 'Customer ' + ['A', 'B', 'C', 'D'][i % 4]
          : undefined,
        status: is_picking ? this.pick_random(statuses) : undefined,
        actual_qty:
          Math.random() > 0.3 ? 5 + Math.floor(Math.random() * 140) : undefined,
        alokasi: is_picking
          ? [
              {
                tujuan: 'Store ' + ((i % 5) + 1),
                qty: 5 + Math.floor(Math.random() * 30),
              },
              {
                tujuan: 'Store ' + (((i + 2) % 5) + 1),
                qty: 5 + Math.floor(Math.random() * 20),
              },
            ]
          : undefined,
        keterangan: notes[i % notes.length],
        shift: this.pick_random(shifts),
        user: this.pick_random(users),
        tanggal_income: this.random_date(30).toISOString().split('T')[0],
        jam_datang: this.random_time(),
        jam_bongkar: this.random_time(),
        jam_selesai: this.random_time(),
        note: notes[(i + 2) % notes.length],
      });
    }
    const saved = await this.stock_log_repo.save(this.stock_log_repo.create(data));
    console.log(`✅ Seed stock_log (${saved.length} rows)`);
  }

  // ── PlanningAyam (27 rows) ──────────────────────────
  private async seed_planning_ayam(barangs: Barang[], shifts: Shift[]) {
    const count = await this.planning_ayam_repo.count();
    if (count > 0) {
      console.log('⏭️  PlanningAyam already seeded');
      return;
    }
    const statuses = ['WAIT', 'PROGRESS', 'DONE', 'CANCEL'];
    const dests = [
      'Customer A',
      'Customer B',
      'Customer C',
      'Cabang Surabaya',
      'Cabang Bandung',
      'Gudang Pusat',
      'Store 1',
      'Store 2',
      'Outlet 3',
      'Resto Group',
    ];
    const notes = [
      'Plan rutin harian',
      'Plan khusus weekend',
      'Plan event catering',
      'Plan stok lebaran',
      'Plan promo akhir bulan',
      'Plan tambahan dari marketing',
    ];

    const data: Partial<PlanningAyam>[] = [];
    // Focus on chicken/meat products for planning_ayam
    const ayam_barangs = barangs.filter(
      (b) =>
        b.nama.toLowerCase().includes('ayam') ||
        b.nama.toLowerCase().includes('daging') ||
        b.nama.toLowerCase().includes('telur') ||
        b.nama.toLowerCase().includes('ikan'),
    );
    const use_barangs = ayam_barangs.length >= 5 ? ayam_barangs : barangs;

    for (let i = 0; i < 27; i++) {
      const b = use_barangs[i % use_barangs.length];
      const s = statuses[i % statuses.length];
      const plan_date = new Date();
      plan_date.setDate(
        plan_date.getDate() -
          Math.floor(Math.random() * 15) +
          Math.floor(Math.random() * 15),
      );
      data.push({
        barang: b,
        qty: 50 + Math.floor(Math.random() * 500),
        satuan: b.satuan,
        tanggal_planning: plan_date,
        shift: this.pick_random(shifts),
        tujuan: dests[i % dests.length],
        status: s,
        keterangan: notes[i % notes.length],
      });
    }
    const saved = await this.planning_ayam_repo.save(
      this.planning_ayam_repo.create(data),
    );
    console.log(`✅ Seed planning_ayam (${saved.length} rows)`);
  }

  // ── OutboundAyam (26 rows) ──────────────────────────
  private async seed_outbound_ayam(plannings: PlanningAyam[], shifts: Shift[]) {
    const count = await this.outbound_ayam_repo.count();
    if (count > 0) {
      console.log('⏭️  OutboundAyam already seeded');
      return;
    }
    const dests = [
      'Customer A',
      'Customer B',
      'Customer C',
      'Cabang Surabaya',
      'Cabang Bandung',
      'Gudang Pusat',
      'Store 1',
      'Store 2',
      'Outlet 3',
      'Resto Group',
    ];
    const notes = [
      'Keluar sesuai plan',
      'Realisasi pengiriman pagi',
      'Pengiriman siang',
      'Pengiriman sore',
      'Kondisi aman',
      'Sesuai jadwal',
      'Tepat waktu',
    ];

    const data: Partial<OutboundAyam>[] = [];
    for (let i = 0; i < 26; i++) {
      const p = plannings[i % plannings.length];
      const planned_qty = Number(p.qty) || 50;
      const actual_qty =
        Math.round(planned_qty * (0.7 + Math.random() * 0.3) * 10) / 10;
      const dest = dests[i % dests.length];
      data.push({
        planning_ayam: p,
        qty_aktual: actual_qty,
        satuan: p.satuan,
        alokasi: [
          { tujuan: dest, qty: Math.round(actual_qty * 0.6 * 10) / 10 },
          {
            tujuan: dest + ' - Sub',
            qty: Math.round(actual_qty * 0.4 * 10) / 10,
          },
        ],
        tujuan: dest,
        shift: this.pick_random(shifts),
        keterangan: notes[i % notes.length],
      });
    }
    const saved = await this.outbound_ayam_repo.save(
      this.outbound_ayam_repo.create(data),
    );
    console.log(`✅ Seed outbound_ayam (${saved.length} rows)`);
  }

  // ── InboundPlanning (27 rows) ──────────────────────
  private async seed_inbound_planning() {
    const count = await this.inbound_planning_repo.count();
    if (count > 0) {
      console.log('⏭️  InboundPlanning already seeded');
      return;
    }
    const barangs = await this.barang_repo.find();
    const drivers = [
      'Budi Santoso',
      'Agus Widodo',
      'Herman Kusuma',
      'Dedi Supriyadi',
      'Rudi Hartono',
      'Eko Prasetyo',
      'Slamet Riyadi',
      'Ahmad Fauzi',
      'Joko Susilo',
      'Andi Wijaya',
    ];
    const suppliers = [
      'PT. Pangan Nusantara',
      'UD. Berkah Jaya',
      'CV. Makmur Sentosa',
      'PT. Sumber Protein Indonesia',
      'PT. Agro Makmur Sejahtera',
      'CV. Tani Jaya Abadi',
      'PT. Hasil Laut Nusantara',
      'UD. Sari Bumi',
    ];
    const statuses = [
      'WAIT',
      'DONE',
      'DONE',
      'WAIT',
      'WAIT',
      'DONE',
      'WAIT',
      'FAIL',
      'DONE',
    ];
    const notes = [
      'Estimasi tepat waktu',
      'Ada keterlambatan 1 jam',
      'Datang lebih awal',
      'Kondisi kendaraan baik',
      'Perlu bongkar ekstra',
      'Barang dalam kondisi baik',
      'Pengiriman gabungan',
      'PO rutin mingguan',
    ];

    const data: Partial<InboundPlanning>[] = [];
    for (let i = 0; i < 27; i++) {
      const eta = new Date();
      eta.setDate(
        eta.getDate() -
          Math.floor(Math.random() * 20) +
          Math.floor(Math.random() * 15),
      );
      const realisasi =
        statuses[i % statuses.length] === 'DONE'
          ? new Date(eta.getTime() + (Math.random() - 0.3) * 3600000)
          : undefined;
      const selisih = realisasi
        ? Math.round((realisasi.getTime() - eta.getTime()) / 60000)
        : undefined;
      const planned_qty = 50 + Math.floor(Math.random() * 450);
      const received_qty = realisasi
        ? Math.round(planned_qty * (0.85 + Math.random() * 0.15))
        : 0;
      const dest = 'Store ' + ((i % 8) + 1);
      const random_barang1 = this.pick_random(barangs);
      const items_list = [
        {
          barang_id: random_barang1?.id || 1,
          qty: planned_qty,
          satuan: random_barang1?.satuan || 'Pcs',
        },
      ];
      data.push({
        no_po: `PO-IN-${String(i + 1).padStart(4, '0')}`,
        supplier: this.pick_random(suppliers),
        qty: planned_qty,
        qty_diterima: realisasi ? received_qty : undefined,
        alokasi: [{ tujuan: dest, qty: planned_qty }],
        items: items_list,
        estimasi_datang: eta,
        status: statuses[i % statuses.length],
        tanggal_realisasi: realisasi,
        selisih_menit: selisih,
        note: notes[i % notes.length],
      });
    }
    const saved = await this.inbound_planning_repo.save(
      this.inbound_planning_repo.create(data),
    );
    console.log(`✅ Seed inbound_planning (${saved.length} rows)`);
  }
}
