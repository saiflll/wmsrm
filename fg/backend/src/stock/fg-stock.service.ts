import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual, MoreThan } from "typeorm";
import { FgStock } from "./fg-stock.entity.js";
import { FgRelasiRakBatch } from "./fg-relasi-rak-batch.entity.js";
import { FgBarang } from "../master-barang/fg-barang.entity.js";
import { FgRak } from "../master-rak/fg-rak.entity.js";
import { FgStatus } from "../master-status/fg-status.entity.js";
import { FgMutasiService } from "../mutasi/fg-mutasi.service.js";
import { v4 as uuid } from "uuid";

@Injectable()
export class FgStockService {
  constructor(
    @InjectRepository(FgStock) private stockRepo: Repository<FgStock>,
    @InjectRepository(FgRelasiRakBatch)
    private relasiRepo: Repository<FgRelasiRakBatch>,
    @InjectRepository(FgBarang) private barangRepo: Repository<FgBarang>,
    @InjectRepository(FgRak) private rakRepo: Repository<FgRak>,
    @InjectRepository(FgStatus) private statusRepo: Repository<FgStatus>,
    private mutasiService: FgMutasiService,
  ) {}

  async findAll(onlyAvailable = true) {
    const where: any = {};
    if (onlyAvailable) where.stockOnhand = MoreThan(0);
    const stocks = await this.stockRepo.find({
      where,
      order: { namaBarang: "ASC", tanggalExpired: "ASC" },
    });
    return stocks;
  }

  async findByIdStock(idStock: string) {
    return this.stockRepo.findOne({ where: { idStock } });
  }

  async findByLotKey(keyLot: string) {
    return this.stockRepo.findOne({ where: { keyLot } });
  }

  async findFefoCandidates(
    namaBarang: string,
    satuan: string,
    filters?: { idStock?: string; nomorBatch?: string; lokasiRak?: string },
  ) {
    const qb = this.stockRepo
      .createQueryBuilder("s")
      .where("s.namaBarang = :namaBarang", { namaBarang })
      .andWhere("s.satuan = :satuan", { satuan })
      .andWhere("s.stockOnhand > 0");

    if (filters?.idStock)
      qb.andWhere("s.idStock = :idStock", { idStock: filters.idStock });
    if (filters?.nomorBatch)
      qb.andWhere("s.nomorBatch = :nomorBatch", {
        nomorBatch: filters.nomorBatch,
      });
    if (filters?.lokasiRak)
      qb.andWhere("s.lokasiRak = :lokasiRak", { lokasiRak: filters.lokasiRak });

    return qb
      .orderBy("s.tanggalExpired", "ASC")
      .addOrderBy("s.tanggalProduksi", "ASC")
      .addOrderBy("s.idStock", "ASC")
      .getMany();
  }

  async addInbound(data: {
    namaBarang: string;
    tanggalProduksi: string;
    tanggalExpired: string;
    status: string;
    lokasiRak: string;
    qty: number;
    satuan: string;
    nomorBstb: string;
    tanggalBstb: string;
    nomorITKirim: string;
    nomorBatch: string;
    namaUser: string;
  }) {
    const keyLot = this.makeLotKey(
      data.namaBarang,
      data.tanggalProduksi,
      data.tanggalExpired,
      data.status,
      data.lokasiRak,
      data.nomorBstb,
      data.satuan,
      data.nomorBatch,
    );
    const existing = await this.findByLotKey(keyLot);

    if (existing) {
      existing.qtyMasuk += data.qty;
      existing.stockOnhand += data.qty;
      existing.nomorITKirimTerakhir = data.nomorITKirim;
      existing.namaUserInputTerakhir = data.namaUser;
      return this.stockRepo.save(existing);
    }

    const stock = this.stockRepo.create({
      idStock: "STK-" + uuid().slice(0, 8).toUpperCase(),
      namaBarang: data.namaBarang,
      tanggalProduksi: data.tanggalProduksi,
      tanggalExpired: data.tanggalExpired,
      status: data.status,
      lokasiRak: data.lokasiRak,
      qtyMasuk: data.qty,
      qtyKeluar: 0,
      stockOnhand: data.qty,
      satuan: data.satuan,
      nomorBstb: data.nomorBstb,
      tanggalBstb: data.tanggalBstb,
      nomorITKirimTerakhir: data.nomorITKirim,
      keyLot,
      namaUserInputTerakhir: data.namaUser,
      nomorBatch: data.nomorBatch,
    });
    return this.stockRepo.save(stock);
  }

  async deductOutbound(idStock: string, qty: number, namaUser: string) {
    const stock = await this.findByIdStock(idStock);
    if (!stock) throw new Error("Stock tidak ditemukan: " + idStock);
    if (stock.stockOnhand < qty)
      throw new Error(
        "Stock tidak cukup. Tersedia: " +
          stock.stockOnhand +
          ", diminta: " +
          qty,
      );

    stock.qtyKeluar += qty;
    stock.stockOnhand -= qty;
    stock.namaUserInputTerakhir = namaUser;
    if (stock.stockOnhand <= 0) {
      return this.stockRepo.remove(stock);
    }
    return this.stockRepo.save(stock);
  }

  async save(stock: FgStock) {
    return this.stockRepo.save(stock);
  }

  async adjustQuantity(idStock: string, newQty: number) {
    const stock = await this.findByIdStock(idStock);
    if (!stock) throw new Error("Stock tidak ditemukan: " + idStock);
    stock.stockOnhand = newQty;
    return this.stockRepo.save(stock);
  }

  async updateLocation(
    idStock: string,
    lokasiBaru: string,
    statusBaru: string,
    namaUser: string,
    keterangan: string,
  ) {
    const stock = await this.findByIdStock(idStock);
    if (!stock) throw new Error("Stock tidak ditemukan: " + idStock);
    stock.lokasiRak = lokasiBaru;
    if (statusBaru) stock.status = statusBaru;
    stock.namaUserInputTerakhir = namaUser;
    return this.stockRepo.save(stock);
  }

  async getExpiringSoon(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return this.stockRepo
      .createQueryBuilder("s")
      .where("s.stockOnhand > 0")
      .andWhere("s.tanggalExpired <= :cutoff", {
        cutoff: cutoff.toISOString().split("T")[0],
      })
      .orderBy("s.tanggalExpired", "ASC")
      .getMany();
  }

  async getSummary() {
    const stocks = await this.findAll(false);
    const available = stocks.filter((s) => s.stockOnhand > 0);
    const now = new Date();
    return {
      totalQty: available.reduce((sum, s) => sum + s.stockOnhand, 0),
      totalLot: available.length,
      expSoon: available.filter((s) => {
        if (!s.tanggalExpired) return false;
        const exp = new Date(s.tanggalExpired);
        const diff = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
        return diff <= 30;
      }).length,
    };
  }

  async getPerItemSummary() {
    const stocks = await this.findAll(true);
    const map: Record<string, { namaBarang: string; satuan: string; totalQty: number; totalLot: number; statuses: Record<string, number> }> = {};
    stocks.forEach((s) => {
      if (!map[s.namaBarang]) map[s.namaBarang] = { namaBarang: s.namaBarang, satuan: s.satuan, totalQty: 0, totalLot: 0, statuses: {} };
      map[s.namaBarang].totalQty += s.stockOnhand;
      map[s.namaBarang].totalLot += 1;
      map[s.namaBarang].statuses[s.status] = (map[s.namaBarang].statuses[s.status] || 0) + s.stockOnhand;
    });
    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
  }

  async getDailyStock(area?: string) {
    const stocks = await this.findAll(true);
    const map: Record<string, { namaBarang: string; satuan: string; release: number; hold: number; waste: number; total: number }> = {};
    const areas = new Set<string>();

    for (const s of stocks) {
      const rackArea = (s.lokasiRak || '').split(/[-\s]/)[0]?.toUpperCase() || 'UNKNOWN';
      areas.add(rackArea);
      if (area && rackArea !== area.toUpperCase()) continue;

      if (!map[s.namaBarang]) {
        map[s.namaBarang] = { namaBarang: s.namaBarang, satuan: s.satuan, release: 0, hold: 0, waste: 0, total: 0 };
      }
      const status = (s.status || '').toUpperCase();
      if (['RELEASE', 'GOOD'].includes(status)) map[s.namaBarang].release += s.stockOnhand;
      else if (status === 'HOLD') map[s.namaBarang].hold += s.stockOnhand;
      else map[s.namaBarang].waste += s.stockOnhand;
      map[s.namaBarang].total += s.stockOnhand;
    }

    return {
      date: new Date().toISOString().split('T')[0],
      area: area || 'ALL',
      areas: Array.from(areas).sort(),
      items: Object.values(map).sort((a, b) => a.namaBarang.localeCompare(b.namaBarang)),
    };
  }

  async importCsv(csvText: string, namaUser: string) {
    const lines = csvText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error("CSV minimal memiliki header dan 1 baris data");

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const get = (row: string[], name: string) => {
      const idx = headers.indexOf(name.toLowerCase());
      return idx >= 0 ? row[idx]?.trim().replace(/"/g, "") : "";
    };

    // Preload master data for validation
    const [barangList, rakList, statusList] = await Promise.all([
      this.barangRepo.find(),
      this.rakRepo.find(),
      this.statusRepo.find(),
    ]);
    const barangSet = new Set(barangList.map((b) => b.nama.toUpperCase()));
    const rakSet = new Set(rakList.map((r) => r.lokasiRak.toUpperCase()));
    const statusSet = new Set(statusList.map((s) => s.status.toUpperCase()));

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      // Simple CSV parse: split by comma, respecting quoted fields
      const row = raw.match(/("[^"]*"|[^,]+)/g)?.map((s) => s.replace(/^"|"$/g, "").trim()) || [];
      if (row.length < headers.length) {
        failed++;
        errors.push(`Baris ${i + 1}: format kolom tidak sesuai`);
        continue;
      }

      try {
        const namaBarang = get(row, "namaBarang");
        const nomorBatch = get(row, "nomorBatch");
        const tanggalProduksi = get(row, "tanggalProduksi");
        const tanggalExpired = get(row, "tanggalExpired");
        const status = (get(row, "status") || "GOOD").toUpperCase();
        const lokasiRak = get(row, "lokasiRak");
        const qty = parseInt(get(row, "qty") || "0", 10);
        const satuan = get(row, "satuan") || "Carton";
        const nomorBstb = get(row, "nomorBstb") || "IMPORT-CSV";
        const tanggalBstb = get(row, "tanggalBstb") || new Date().toISOString().split("T")[0];

        if (!namaBarang || !lokasiRak || !tanggalProduksi || qty <= 0) {
          failed++;
          errors.push(`Baris ${i + 1}: namaBarang, lokasiRak, tanggalProduksi, dan qty wajib diisi`);
          continue;
        }

        if (!barangSet.has(namaBarang.toUpperCase())) {
          failed++;
          errors.push(`Baris ${i + 1}: barang '${namaBarang}' tidak terdaftar di DATABASE_BARANG`);
          continue;
        }
        if (!rakSet.has(lokasiRak.toUpperCase())) {
          failed++;
          errors.push(`Baris ${i + 1}: rak '${lokasiRak}' tidak terdaftar di DATABASE_RAK`);
          continue;
        }
        if (!statusSet.has(status)) {
          failed++;
          errors.push(`Baris ${i + 1}: status '${status}' tidak terdaftar di DATABASE_STATUS`);
          continue;
        }

        const stock = await this.addInbound({
          namaBarang,
          tanggalProduksi,
          tanggalExpired,
          status,
          lokasiRak,
          qty,
          satuan,
          nomorBstb,
          tanggalBstb,
          nomorITKirim: "",
          nomorBatch,
          namaUser,
        });

        await this.mutasiService.logMutasi({
          jenisMutasi: "IN",
          tanggalTransaksi: tanggalBstb,
          namaBarang,
          tanggalProduksi,
          tanggalExpired,
          status,
          lokasiRak,
          qtyMasuk: qty,
          qtyKeluar: 0,
          saldoAkhirLot: stock.stockOnhand,
          satuan,
          idStock: stock.idStock,
          nomorBstb,
          shiftKoordinator: "IMPORT CSV",
          namaUserTransaksi: namaUser,
          keterangan: "Import stock dari CSV",
          nomorBatch,
        });

        success++;
      } catch (err: any) {
        failed++;
        errors.push(`Baris ${i + 1}: ${err.message || err}`);
      }
    }

    await this.syncRelasiRakBatch();

    return {
      message: `Import CSV selesai. Berhasil: ${success}, Gagal: ${failed}`,
      success,
      failed,
      errors: errors.slice(0, 20),
    };
  }

  async syncRelasiRakBatch() {
    const stocks = await this.findAll(false);
    await this.relasiRepo.clear();
    const rows = stocks.map((s) =>
      this.relasiRepo.create({
        idStock: s.idStock,
        keyLot: s.keyLot,
        lokasiRak: s.lokasiRak,
        nomorBatch: s.nomorBatch,
        namaBarang: s.namaBarang,
        tanggalProduksi: s.tanggalProduksi,
        tanggalExpired: s.tanggalExpired,
        status: s.status,
        stockOnhand: s.stockOnhand,
        satuan: s.satuan,
        nomorBstb: s.nomorBstb,
        tanggalBstb: s.tanggalBstb,
        namaUserInputTerakhir: s.namaUserInputTerakhir,
      }),
    );
    return this.relasiRepo.save(rows);
  }

  private makeLotKey(
    namaBarang: string,
    tanggalProduksi: string,
    tanggalExpired: string,
    status: string,
    lokasiRak: string,
    nomorBstb: string,
    satuan: string,
    nomorBatch: string,
  ): string {
    return [
      namaBarang,
      tanggalProduksi,
      tanggalExpired,
      status,
      lokasiRak,
      nomorBstb,
      satuan,
      nomorBatch,
    ]
      .map((s) => (s || "").toString().trim().toUpperCase())
      .join("|");
  }
}
