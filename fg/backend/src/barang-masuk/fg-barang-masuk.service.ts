import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { FgBarangMasuk } from "./fg-barang-masuk.entity.js";
import { FgNoticeTransaksi } from "./fg-notice-transaksi.entity.js";
import { FgStockService } from "../stock/fg-stock.service.js";
import { FgMutasiService } from "../mutasi/fg-mutasi.service.js";
import { FgBarang } from "../master-barang/fg-barang.entity.js";
import { FgRak } from "../master-rak/fg-rak.entity.js";
import { FgStock } from "../stock/fg-stock.entity.js";
import { FgBarangKeluar } from "../barang-keluar/fg-barang-keluar.entity.js";

@Injectable()
export class FgBarangMasukService {
  constructor(
    @InjectRepository(FgBarangMasuk) private bmRepo: Repository<FgBarangMasuk>,
    @InjectRepository(FgNoticeTransaksi)
    private noticeRepo: Repository<FgNoticeTransaksi>,
    @InjectRepository(FgBarang) private barangRepo: Repository<FgBarang>,
    @InjectRepository(FgRak) private rakRepo: Repository<FgRak>,
    @InjectRepository(FgStock) private stockRepo: Repository<FgStock>,
    @InjectRepository(FgBarangKeluar)
    private bkRepo: Repository<FgBarangKeluar>,
    private stockService: FgStockService,
    private mutasiService: FgMutasiService,
    private dataSource: DataSource,
  ) {}

  async submitBarangMasuk(data: {
    tanggalBstb: string;
    tanggalProduksi: string;
    namaBarang: string;
    satuan: string;
    status: string;
    shiftIn: string;
    nomorBstb: string;
    nomorITKirim?: string;
    keterangan?: string;
    namaUserTransaksi: string;
    waktuMasukCS?: string;
    batches: Array<{
      nomorBatch: string;
      qty: number;
      lokasiRak: string;
      keterangan?: string;
    }>;
  }) {
    if (!data.batches?.length)
      throw new BadRequestException("Minimal 1 batch barang masuk");

    const barang = await this.barangRepo.findOne({
      where: { nama: data.namaBarang },
    });
    const expiredBulan = barang?.umurExpiredBulan || 0;
    const tanggalExpired = this.calculateExpiredDate(
      data.tanggalProduksi,
      expiredBulan,
    );

    const now = new Date();
    const jamIn = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });

    let savedRows = 0;
    let savedQty = 0;

    for (const batch of data.batches) {
      // Validate rack capacity
      const rak = await this.rakRepo.findOne({
        where: { lokasiRak: batch.lokasiRak },
      });
      if (
        rak &&
        rak.kapasitasRak > 0 &&
        rak.jenisRak !== "FLOOR" &&
        rak.jenisRak !== "GANGWAY"
      ) {
        const currentStocks = await this.stockRepo.find({
          where: { lokasiRak: batch.lokasiRak },
        });
        const currentQty = currentStocks.reduce(
          (sum, s) => sum + s.stockOnhand,
          0,
        );
        if (currentQty + batch.qty > rak.kapasitasRak) {
          throw new BadRequestException(
            `Rak ${batch.lokasiRak} melebihi kapasitas! Kapasitas: ${rak.kapasitasRak}, terisi: ${currentQty}, tambahan: ${batch.qty}`,
          );
        }
      }

      await this.bmRepo.save(
        this.bmRepo.create({
          tanggalBstb: data.tanggalBstb,
          tanggalProduksi: data.tanggalProduksi,
          tanggalExpired,
          namaBarang: data.namaBarang,
          totalQty: batch.qty,
          satuan: data.satuan,
          status: data.status,
          shiftIn: data.shiftIn,
          nomorBstb: data.nomorBstb,
          lokasiRak: batch.lokasiRak,
          nomorITKirim: data.nomorITKirim || "",
          keterangan: batch.keterangan || data.keterangan || "",
          jamIn,
          namaUserTransaksi: data.namaUserTransaksi,
          nomorBatch: batch.nomorBatch,
          waktuMasukCS: data.waktuMasukCS || "",
        }),
      );

      const stock = await this.stockService.addInbound({
        namaBarang: data.namaBarang,
        tanggalProduksi: data.tanggalProduksi,
        tanggalExpired,
        status: data.status,
        lokasiRak: batch.lokasiRak,
        qty: batch.qty,
        satuan: data.satuan,
        nomorBstb: data.nomorBstb,
        tanggalBstb: data.tanggalBstb,
        nomorITKirim: data.nomorITKirim || "",
        nomorBatch: batch.nomorBatch,
        namaUser: data.namaUserTransaksi,
      });

      await this.mutasiService.logMutasi({
        jenisMutasi: "IN",
        tanggalTransaksi: data.tanggalBstb,
        namaBarang: data.namaBarang,
        tanggalProduksi: data.tanggalProduksi,
        tanggalExpired,
        status: data.status,
        lokasiRak: batch.lokasiRak,
        qtyMasuk: batch.qty,
        qtyKeluar: 0,
        saldoAkhirLot: stock.stockOnhand,
        satuan: data.satuan,
        idStock: stock.idStock,
        nomorBstb: data.nomorBstb,
        shiftKoordinator: data.shiftIn,
        namaUserTransaksi: data.namaUserTransaksi,
        keterangan: batch.keterangan || "",
        nomorBatch: batch.nomorBatch,
      });

      savedRows++;
      savedQty += batch.qty;
    }

    await this.stockService.syncRelasiRakBatch();

    return {
      message: `Barang masuk berhasil. Total batch: ${savedRows}, total qty: ${savedQty} ${data.satuan}`,
      totalBatch: savedRows,
      totalQty: savedQty,
    };
  }

  async getBarangMasukList(startDate?: string, endDate?: string) {
    const qb = this.bmRepo
      .createQueryBuilder("bm")
      .orderBy("bm.timestampInput", "DESC");
    if (startDate)
      qb.andWhere("bm.tanggalBstb >= :start", { start: startDate });
    if (endDate) qb.andWhere("bm.tanggalBstb <= :end", { end: endDate });
    return qb.take(500).getMany();
  }

  async rollback(id: number, namaUser: string) {
    const row = await this.bmRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Barang masuk tidak ditemukan');

    const barang = await this.barangRepo.findOne({
      where: { nama: row.namaBarang },
    });
    const expiredBulan = barang?.umurExpiredBulan || 0;
    const tanggalExpired = this.calculateExpiredDate(
      row.tanggalProduksi,
      expiredBulan,
    );

    const keyLot = this.makeLotKey(
      row.namaBarang,
      row.tanggalProduksi,
      tanggalExpired,
      row.status,
      row.lokasiRak,
      row.nomorBstb,
      row.satuan,
      row.nomorBatch,
    );

    const stock = await this.stockRepo.findOne({ where: { keyLot } });
    if (!stock) throw new BadRequestException('Stock lot tidak ditemukan untuk rollback');

    const newOnhand = stock.stockOnhand - row.totalQty;
    const newQtyMasuk = stock.qtyMasuk - row.totalQty;
    if (newOnhand < 0) {
      throw new BadRequestException(`Tidak bisa rollback: stock on hand akan menjadi negatif (${newOnhand}). Stock sudah keluar/terpakai.`);
    }

    stock.stockOnhand = newOnhand;
    stock.qtyMasuk = newQtyMasuk;
    stock.namaUserInputTerakhir = namaUser;
    await this.stockRepo.save(stock);

    await this.mutasiService.logMutasi({
      jenisMutasi: 'ROLLBACK_IN',
      tanggalTransaksi: row.tanggalBstb,
      namaBarang: row.namaBarang,
      tanggalProduksi: row.tanggalProduksi,
      tanggalExpired: row.tanggalExpired,
      status: row.status,
      lokasiRak: row.lokasiRak,
      qtyMasuk: -row.totalQty,
      qtyKeluar: 0,
      saldoAkhirLot: stock.stockOnhand,
      satuan: row.satuan,
      idStock: stock.idStock,
      nomorBstb: row.nomorBstb,
      shiftKoordinator: row.shiftIn,
      namaUserTransaksi: namaUser,
      keterangan: `Rollback barang masuk id ${id}`,
      nomorBatch: row.nomorBatch,
    });

    await this.bmRepo.delete(id);
    await this.stockService.syncRelasiRakBatch();

    return {
      message: `Rollback barang masuk ${id} berhasil. Stock ${stock.idStock} dikurangi ${row.totalQty}. On hand sekarang: ${stock.stockOnhand}.`,
    };
  }

  async checkNotice(data: {
    tanggalBstb: string;
    tanggalProduksi: string;
    namaBarang: string;
    satuan: string;
    status: string;
    nomorBstb: string;
    batches: Array<{ nomorBatch: string; qty: number; lokasiRak: string }>;
    namaUserTransaksi?: string;
  }) {
    const notices: string[] = [];
    const barang = await this.barangRepo.findOne({
      where: { nama: data.namaBarang },
    });
    const expiredBulan = barang?.umurExpiredBulan || 0;
    const tanggalExpired = this.calculateExpiredDate(
      data.tanggalProduksi,
      expiredBulan,
    );

    const keyData = [
      "IN",
      data.tanggalBstb,
      data.nomorBstb,
      data.namaBarang,
      data.tanggalProduksi,
      data.satuan,
    ].join("|");

    for (const batch of data.batches) {
      const lokasiRak = batch.lokasiRak;
      const nomorBatch = batch.nomorBatch;
      const labelBatch = nomorBatch ? `batch ${nomorBatch}, ` : "";

      // 1. Exact duplicate
      const exactRows = await this.bmRepo.find({
        where: {
          nomorBstb: data.nomorBstb,
          namaBarang: data.namaBarang,
          lokasiRak,
          satuan: data.satuan,
          tanggalBstb: data.tanggalBstb,
          tanggalProduksi: data.tanggalProduksi,
          ...(nomorBatch ? { nomorBatch } : {}),
        },
      });
      if (exactRows.length) {
        notices.push(
          `Barang masuk ${labelBatch}dengan Nomor BSTB, barang, tanggal produksi, satuan, dan lokasi rak yang sama sudah ada ${exactRows.length} baris di BARANG_MASUK.`,
        );
      }

      // 2. Same day rack usage by different BSTB
      const sameDayRackRows = await this.bmRepo.find({
        where: {
          lokasiRak,
          tanggalBstb: data.tanggalBstb,
          nomorBstb: data.nomorBstb ? undefined : data.nomorBstb,
        },
      });
      const differentBstbRows = sameDayRackRows.filter(
        (r) => r.nomorBstb !== data.nomorBstb,
      );
      if (differentBstbRows.length) {
        notices.push(
          `Lokasi rak ${lokasiRak} sudah dipakai transaksi barang masuk lain pada tanggal BSTB yang sama. Cek agar rak tidak dipakai ganda.`,
        );
      }

      // 3. Same lot stock already exists
      if (tanggalExpired) {
        const keyLot = this.makeLotKey(
          data.namaBarang,
          data.tanggalProduksi,
          tanggalExpired,
          data.status,
          lokasiRak,
          data.nomorBstb,
          data.satuan,
          nomorBatch,
        );
        const stockLot = await this.stockRepo.findOne({ where: { keyLot } });
        if (stockLot) {
          notices.push(
            `Lot stock yang sama sudah ada di STOCK_ONHAND: ${stockLot.idStock}, batch ${stockLot.nomorBatch || nomorBatch || "-"}, stock saat ini ${stockLot.stockOnhand} ${stockLot.satuan}, input terakhir: ${stockLot.namaUserInputTerakhir || "-"}.`,
          );
        }
      }

      // 4. Last out same rack on same day
      const lastOut = await this.bkRepo.findOne({
        where: { lokasiRak },
        order: { timestampInput: "DESC" },
      });
      if (lastOut && lastOut.tanggalDimuat === data.tanggalBstb) {
        notices.push(
          `Info rak ${lokasiRak}: pada tanggal yang sama ada transaksi BARANG KELUAR tanggal ${lastOut.tanggalDimuat} untuk ${lastOut.namaBarang}, qty ${lastOut.qtyKeluar} ${lastOut.satuan}.`,
        );
      }

      // 5. Same rack has active stock
      const stockSameRackRows = await this.stockRepo.find({
        where: { lokasiRak },
      });
      const activeStocks = stockSameRackRows.filter((s) => s.stockOnhand > 0);
      if (activeStocks.length) {
        const totalRackQty = activeStocks.reduce(
          (sum, s) => sum + s.stockOnhand,
          0,
        );
        notices.push(
          `Info rak ${lokasiRak}: masih ada ${activeStocks.length} batch/lot aktif dengan total stock ${totalRackQty}. Sistem tetap mengizinkan barang masuk ke rak ini selama nomor batch/lot dibedakan.`,
        );
      }
    }

    // 6. Same BSTB for same barang on same date
    const sameBstbRows = await this.bmRepo.find({
      where: {
        nomorBstb: data.nomorBstb,
        namaBarang: data.namaBarang,
        tanggalBstb: data.tanggalBstb,
      },
    });
    if (sameBstbRows.length) {
      notices.push(
        `Nomor BSTB ${data.nomorBstb} untuk barang ${data.namaBarang} pada tanggal BSTB yang sama sudah pernah diinput ${sameBstbRows.length} baris. Pastikan bukan input ulang oleh koordinator lain.`,
      );
    }

    return {
      noticeType: "BARANG_MASUK",
      keyData,
      notices,
      hasNotice: notices.length > 0,
    };
  }

  async logNotice(
    data: {
      jenisTransaksi: string;
      levelNotice: string;
      keyData: string;
      pesanNotice: string;
      userKoordinator?: string;
      statusTindakan?: string;
    },
  ) {
    return this.noticeRepo.save(
      this.noticeRepo.create({
        jenisTransaksi: data.jenisTransaksi,
        levelNotice: data.levelNotice,
        keyData: data.keyData,
        pesanNotice: data.pesanNotice,
        userKoordinator: data.userKoordinator || "",
        statusTindakan: data.statusTindakan || "",
      }),
    );
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
    ].join("#");
  }

  private calculateExpiredDate(tanggalProduksi: string, bulan: number): string {
    if (!tanggalProduksi || bulan <= 0) return "";
    const d = new Date(tanggalProduksi);
    d.setMonth(d.getMonth() + bulan);
    return d.toISOString().split("T")[0];
  }
}
