import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './users/user.entity';
import { Shift } from './shifts/shift.entity';
import { Suplayer } from './suplayers/suplayer.entity';
import { Barang, KategoriBarang } from './barang/barang.entity';
import { Gudang, GudangType, GudangZone } from './gudang/gudang.entity';
import { Customer } from './customers/customer.entity';
import { Stock } from './inventory/stock.entity';
import { StockLog, LogType } from './inventory/stock-log.entity';
import { InboundPlanning } from './inbound-planning/inbound-planning.entity';
import { PlanningAyam } from './planning-ayam/planning-ayam.entity';
import { OutboundAyam } from './outbound-ayam/outbound-ayam.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
    constructor(
        @InjectRepository(User) private userRepo: Repository<User>,
        @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
        @InjectRepository(Suplayer) private suplayerRepo: Repository<Suplayer>,
        @InjectRepository(Barang) private barangRepo: Repository<Barang>,
        @InjectRepository(Gudang) private gudangRepo: Repository<Gudang>,
        @InjectRepository(Customer) private customerRepo: Repository<Customer>,
        @InjectRepository(Stock) private stockRepo: Repository<Stock>,
        @InjectRepository(StockLog) private logRepo: Repository<StockLog>,
        @InjectRepository(InboundPlanning) private inboundPlanningRepo: Repository<InboundPlanning>,
        @InjectRepository(PlanningAyam) private planningAyamRepo: Repository<PlanningAyam>,
        @InjectRepository(OutboundAyam) private outboundAyamRepo: Repository<OutboundAyam>,
    ) { }

    async onApplicationBootstrap() {
        await this.seedUsers();
        await this.seedShifts();
        await this.seedGudang();
        await this.seedBarang();
        await this.seedCustomers();
        await this.seedStock();
        await this.seedInboundPlanning();
        await this.seedPlanningAyam();
    }

    private async seedUsers() {
        const hasUsers = await this.userRepo.count() > 0;
        if (!hasUsers) {
            const users = [
                { username: 'checker', pass: await bcrypt.hash('checker123', 10), role: UserRole.CHECKER },
                { username: 'admin', pass: await bcrypt.hash('admin123', 10), role: UserRole.ADMIN },
                { username: 'koordinator', pass: await bcrypt.hash('koord123', 10), role: UserRole.KOORDINATOR },
                { username: 'supervisor', pass: await bcrypt.hash('super123', 10), role: UserRole.SUPERVISOR },
                { username: 'superadmin', pass: await bcrypt.hash('super123', 10), role: UserRole.SUPER_ADMIN },
                { username: 'manager', pass: await bcrypt.hash('manager123', 10), role: UserRole.MANAGER },
            ];
            await this.userRepo.save(this.userRepo.create(users));
            console.log('✅ Seed users');
        } else {
            const superadminExists = await this.userRepo.findOne({ where: { username: 'superadmin' } });
            if (!superadminExists) {
                const sa = this.userRepo.create({
                    username: 'superadmin',
                    pass: await bcrypt.hash('super123', 10),
                    role: UserRole.SUPER_ADMIN,
                });
                await this.userRepo.save(sa);
                console.log('✅ Added missing superadmin user');
            }
        }
    }

    private async seedShifts() {
        if (await this.shiftRepo.count() > 0) return;
        await this.shiftRepo.save(this.shiftRepo.create([
            { name: 'Shift 1' }, { name: 'Shift 2' }, { name: 'Shift 3' },
        ]));
        console.log('✅ Seed shifts');
    }

    private async seedSuplayers() {
        if (await this.suplayerRepo.count() > 0) return;
        await this.suplayerRepo.save(this.suplayerRepo.create([
            { name: 'JAPFA', alamat: 'Semarang', telp: '024-7654321' },
            { name: 'PT. BINA SAN PRIMA', alamat: 'Semarang', telp: '024-1234567' },
            { name: 'Kunci Mas', alamat: 'Jakarta', telp: '021-9876543' },
            { name: 'MUI Foods', alamat: 'Surabaya', telp: '031-1112233' },
            { name: 'CV Logistik Jaya', alamat: 'Boyolali', telp: '0276-321654' },
        ]));
        console.log('✅ Seed suplayers');
    }

    private async seedCustomers() {
        if (await this.customerRepo.count() > 0) return;
        await this.customerRepo.save(this.customerRepo.create([
            { nama: 'Produksi AP', alamat: 'Internal', telp: '-', tipe: 'internal' },
            { nama: 'Produksi Acin', alamat: 'Internal', telp: '-', tipe: 'internal' },
            { nama: 'PT. Wahana Berkah Sejahtera', alamat: 'Boyolali', telp: '02110989', tipe: 'customer' },
            { nama: 'PT. Sariboga', alamat: 'Jakarta', telp: '02110989', tipe: 'customer' },
        ]));
        console.log('✅ Seed customers');
    }

    private async seedBarang() {
        if (await this.barangRepo.count() > 0) return;

        const items = [
            // WET items
            { sku: 'BRG001', nama: 'Ayam Dada Fillet Chilled - Cp', kategori: KategoriBarang.WET, side: false, satuan: 'Kg', stok: 520 },
            { sku: 'BRG010', nama: 'Ayam Paha Fillet-Cp', kategori: KategoriBarang.WET, side: false, satuan: 'Kg', stok: 180 },
            { sku: 'BRG002', nama: 'Ayam Dada Fillet Frozen - Cp', kategori: KategoriBarang.WET, side: false, satuan: 'Kg', stok: 314 },
            { sku: 'BRG012', nama: 'Udang Kupas - Cp', kategori: KategoriBarang.WET, side: false, satuan: 'Pack', stok: 250 },
            { sku: 'BRG013', nama: 'Udang Thawing', kategori: KategoriBarang.WET, side: false, satuan: 'Box', stok: 120 },

            // DRY items
            { sku: 'BRG003', nama: 'Tepung Tapioka Rosebrand', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 750 },
            { sku: 'BRG004', nama: 'Tepung Tapioka Lusha', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 620 },
            { sku: 'BRG005', nama: 'Garam Halus', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 300 },
            { sku: 'BRG006', nama: 'Gula Pasir', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 220 },
            { sku: 'BRG008', nama: 'Isolated Soy Protein (ISP)', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 410 },
            { sku: 'BRG009', nama: 'Kecap Asin', kategori: KategoriBarang.DRY, side: true, satuan: 'Ltr', stok: 95 },
            { sku: 'BRG011', nama: 'Minyak Goreng', kategori: KategoriBarang.DRY, side: true, satuan: 'Ltr', stok: 400 },
            { sku: 'BRG014', nama: 'Bawang Putih Bubuk', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 65 },
            { sku: 'BRG015', nama: 'Merica Bubuk', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 42 },
            { sku: 'BRG016', nama: 'Bawang Bombay - Cp', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 150 },
            { sku: 'BRG017', nama: 'Es Serut - Cp', kategori: KategoriBarang.DRY, side: true, satuan: 'Satd', stok: 80 },
            { sku: 'BRG018', nama: 'Kulit Tahu Kaca - Cp', kategori: KategoriBarang.DRY, side: true, satuan: 'Lembar', stok: 200 },
            { sku: 'BRG019', nama: 'Keju', kategori: KategoriBarang.DRY, side: true, satuan: 'Kg', stok: 90 },
        ];
        await this.barangRepo.save(this.barangRepo.create(items));
        console.log('✅ Seed barang');
    }

    private async seedGudang() {
        if (await this.gudangRepo.count() > 0) return;

        const mkRacks = (zone: string, side: boolean, koloms: string[], nums: number, levels: number, type: GudangType) => {
            const racks: Partial<Gudang>[] = [];
            for (const k of koloms) {
                for (let n = 1; n <= nums; n++) {
                    for (let l = 1; l <= levels; l++) {
                        racks.push({ name: `${k}${n}.${l}`, side, zone, kolom: k, level: l, type, status: true });
                    }
                }
            }
            return racks;
        };

        const all = [
            ...mkRacks('A', false, ['A', 'B'], 12, 3, GudangType.SINGLE_DEEP),
            ...mkRacks('B', false, ['A', 'B'], 8, 3, GudangType.SINGLE_DEEP),
            ...mkRacks('C', true, ['A', 'B'], 12, 3, GudangType.SINGLE_DEEP),
            ...mkRacks('D', true, ['A', 'B', 'C'], 12, 3, GudangType.DOUBLE_DEEP),
            ...mkRacks('E', true, ['A', 'B', 'C', 'D'], 12, 3, GudangType.DOUBLE_DEEP),
        ];

        const chunkSize = 50;
        for (let i = 0; i < all.length; i += chunkSize) {
            const chunk = all.slice(i, i + chunkSize);
            await this.gudangRepo.save(this.gudangRepo.create(chunk));
        }
        console.log(`✅ Seed gudang (${all.length} racks)`);
    }

    private async seedStock() {
        if (await this.stockRepo.count() > 0) return;

        const barangs = await this.barangRepo.find();
        const gudangs = await this.gudangRepo.find();
        const shifts = await this.shiftRepo.find();

        if (!barangs.length || !gudangs.length) return;

        const dryRacks = gudangs.filter(g => g.side);
        const wetRacks = gudangs.filter(g => !g.side);

        const stocks: Partial<Stock>[] = [];
        const logs: Partial<StockLog>[] = [];

        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        for (const brg of barangs) {
            const racks = brg.side ? dryRacks : wetRacks;
            if (!racks.length) continue;

            const count = Math.min(3 + Math.floor(Math.random() * 3), racks.length);
            const used = new Set<number>();
            for (let i = 0; i < count; i++) {
                let idx: number;
                do { idx = Math.floor(Math.random() * racks.length); } while (used.has(idx));
                used.add(idx);

                const gdg = racks[idx];
                const qty = Math.floor(Math.random() * 200 + 100);
                const expDate = new Date();
                expDate.setDate(expDate.getDate() + Math.floor(Math.random() * 365 + 30));

                const batchNo = `LOT-${brg.sku?.slice(-3) || 'X'}-${2600 + Math.floor(Math.random() * 5)}`;

                // Spread inbound log date across 1 year
                const inboundDate = new Date(oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime()));

                stocks.push({
                    barang: brg, gudang: gdg,
                    batch_no: batchNo, qty,
                    expiry_date: expDate,
                    satuan: brg.satuan,
                });

                logs.push({
                    type: LogType.INBOUND,
                    no_po: `PO-${String(Math.floor(Math.random() * 900000) + 100000)}${i}`,
                    barang: brg, gudang: gdg,
                    qty: qty + Math.floor(Math.random() * 50),
                    satuan: brg.satuan,
                    batch_no: batchNo,
                    expiry_date: expDate,
                    supplier: ['JAPFA', 'PT. BINA SAN PRIMA', 'Kunci Mas'][Math.floor(Math.random() * 3)],
                    shift: shifts[Math.floor(Math.random() * shifts.length)],
                    created_at: inboundDate,
                });

                // Outbound log spread across 1 year
                if (Math.random() > 0.3) {
                    const outDate = new Date(inboundDate.getTime() + Math.random() * (now.getTime() - inboundDate.getTime()));
                    logs.push({
                        type: LogType.OUTBOUND,
                        no_ref: `PICK-${String(Math.floor(Math.random() * 90000) + 10000)}${Math.floor(Math.random() * 99)}`,
                        barang: brg, gudang: gdg,
                        qty: Math.floor(Math.random() * 30 + 10),
                        satuan: brg.satuan,
                        batch_no: batchNo,
                        tujuan: ['Gudang FG', 'Produksi Internal', 'Customer Ekstra'][Math.floor(Math.random() * 3)],
                        shift: shifts[Math.floor(Math.random() * shifts.length)],
                        created_at: outDate,
                    });
                }

                if (Math.random() > 0.6) {
                    const extraRacks = racks.filter(r => r.id !== gdg.id);
                    if (extraRacks.length > 0) {
                        const targetGdg = extraRacks[Math.floor(Math.random() * extraRacks.length)];
                        const relDate = new Date(inboundDate.getTime() + Math.random() * (now.getTime() - inboundDate.getTime()));
                        logs.push({
                            type: LogType.RELOCATION,
                            barang: brg, gudang: targetGdg, gudang_tujuan: gdg,
                            qty: Math.floor(Math.random() * 20 + 5),
                            satuan: brg.satuan,
                            batch_no: batchNo,
                            expiry_date: expDate,
                            shift: shifts[Math.floor(Math.random() * shifts.length)],
                            created_at: relDate,
                        });
                    }
                }

                if (Math.random() > 0.7) {
                    const opnameDate = new Date(inboundDate.getTime() + Math.random() * (now.getTime() - inboundDate.getTime()));
                    logs.push({
                        type: LogType.OPNAME,
                        barang: brg, gudang: gdg,
                        qty: qty,
                        satuan: brg.satuan,
                        batch_no: batchNo,
                        shift: shifts[Math.floor(Math.random() * shifts.length)],
                        created_at: opnameDate,
                    });
                }
            }
        }

        for (let i = 0; i < stocks.length; i += 20) {
            await this.stockRepo.save(this.stockRepo.create(stocks.slice(i, i + 20)));
        }
        for (let i = 0; i < logs.length; i += 20) {
            await this.logRepo.save(this.logRepo.create(logs.slice(i, i + 20)));
        }
        console.log(`✅ Seed stock (${stocks.length} positions) + mixed logs (In, Out, Move, Opname)`);
    }

    private async seedInboundPlanning() {
        if (await this.inboundPlanningRepo.count() > 0) return;

        const barangs = await this.barangRepo.find();
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const plans: Partial<InboundPlanning>[] = [];
        const suppliers = ['JAPFA', 'PT. BINA SAN PRIMA', 'Kunci Mas', 'MUI Foods', 'CV Logistik Jaya'];

        // Create ~100 planning records spread across 1 year
        for (let i = 0; i < 100; i++) {
            const planDate = new Date(oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime()));
            const isDone = Math.random() > 0.2;
            const isLate = Math.random() > 0.6;
            const selisih = isDone ? (isLate ? Math.floor(Math.random() * 120 + 10) : -Math.floor(Math.random() * 60)) : undefined;

            const realisasi = isDone ? new Date(planDate.getTime() + (selisih || 0) * 60000) : undefined;

            plans.push({
                no_po: `PO-${String(Math.floor(Math.random() * 900000) + 100000)}`,
                driver_name: `Driver ${Math.floor(Math.random() * 20) + 1}`,
                plat_nomor: `B ${Math.floor(Math.random() * 9000) + 1000} XX`,
                supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
                qty: Math.floor(Math.random() * 500 + 100),
                qty_diterima: isDone ? Math.floor(Math.random() * 500 + 100) : undefined,
                estimasi_datang: planDate,
                status: isDone ? 'DONE' : 'WAIT',
                tanggal_realisasi: realisasi,
                selisih_menit: selisih,
            });
        }

        for (let i = 0; i < plans.length; i += 20) {
            await this.inboundPlanningRepo.save(this.inboundPlanningRepo.create(plans.slice(i, i + 20)));
        }
        console.log(`✅ Seed inbound planning (${plans.length} records)`);
    }

    private async seedPlanningAyam() {
        if (await this.planningAyamRepo.count() > 0) return;

        const ayamItems = await this.barangRepo.find({ where: { kategori: KategoriBarang.WET } });
        if (!ayamItems.length) return;

        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const plans: Partial<PlanningAyam>[] = [];
        const outbounds: Partial<OutboundAyam>[] = [];
        const shifts = await this.shiftRepo.find();

        // Create weekly planning for 1 year (~52 weeks)
        for (let week = 0; week < 52; week++) {
            const planDate = new Date(oneYearAgo);
            planDate.setDate(planDate.getDate() + week * 7);

            for (const item of ayamItems.slice(0, 3)) {
                const qty = Math.floor(Math.random() * 200 + 100);
                const plan = this.planningAyamRepo.create({
                    barang: item,
                    qty,
                    satuan: item.satuan,
                    tanggal_planning: planDate,
                    shift: shifts[Math.floor(Math.random() * shifts.length)],
                    tujuan: 'Produksi Internal',
                    status: 'DONE',
                });
                plans.push(plan);

                // Create outbound with ~80% serapan rate
                if (Math.random() > 0.1) {
                    const serapanPct = 0.7 + Math.random() * 0.3;
                    outbounds.push({
                        planning_ayam: plan,
                        qty_aktual: Math.floor(qty * serapanPct),
                        satuan: item.satuan,
                        tujuan: 'Produksi Internal',
                        shift: shifts[Math.floor(Math.random() * shifts.length)],
                        created_at: planDate,
                    });
                }
            }
        }

        for (let i = 0; i < plans.length; i += 20) {
            await this.planningAyamRepo.save(plans.slice(i, i + 20));
        }
        for (let i = 0; i < outbounds.length; i += 20) {
            await this.outboundAyamRepo.save(outbounds.slice(i, i + 20));
        }
        console.log(`✅ Seed planning ayam (${plans.length} plans, ${outbounds.length} outbounds)`);
    }
}
