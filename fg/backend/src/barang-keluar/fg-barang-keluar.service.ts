import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FgBarangKeluar } from './fg-barang-keluar.entity.js';
import { FgLogEditBarangKeluar } from './fg-log-edit-barang-keluar.entity.js';
import { FgStockService } from '../stock/fg-stock.service.js';
import { FgMutasiService } from '../mutasi/fg-mutasi.service.js';
import { FgOtdrService } from '../otdr/fg-otdr.service.js';
import { FgResto } from '../master-resto/fg-resto.entity.js';
import { FgPickingList } from '../picking-list/fg-picking-list.entity.js';
import { FgNoticeTransaksi } from '../barang-masuk/fg-notice-transaksi.entity.js';
import { FgOtdr } from '../otdr/fg-otdr.entity.js';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FgBarangKeluarService {
  constructor(
    @InjectRepository(FgBarangKeluar) private bkRepo: Repository<FgBarangKeluar>,
    @InjectRepository(FgLogEditBarangKeluar) private logEditRepo: Repository<FgLogEditBarangKeluar>,
    @InjectRepository(FgResto) private restoRepo: Repository<FgResto>,
    @InjectRepository(FgPickingList) private pickingRepo: Repository<FgPickingList>,
    @InjectRepository(FgNoticeTransaksi) private noticeRepo: Repository<FgNoticeTransaksi>,
    @InjectRepository(FgOtdr) private otdrRepo: Repository<FgOtdr>,
    private stockService: FgStockService,
    private mutasiService: FgMutasiService,
    private otdrService: FgOtdrService,
    private dataSource: DataSource,
  ) {}

  async submitBarangKeluar(data: {
    tglDimuat: string;
    restoId: number;
    shiftOut: string;
    nomorSuratJalan: string;
    nomorITKirim?: string;
    keterangan?: string;
    namaUserTransaksi: string;
    outputs: Array<{
      namaBarang: string;
      qtyKeluar: number;
      satuan: string;
      lokasiRak?: string;
      idStock?: string;
      nomorBatch?: string;
      keterangan?: string;
    }>;
  }) {
    const resto = await this.restoRepo.findOne({ where: { id: data.restoId } });
    if (!resto) throw new BadRequestException('Resto tidak ditemukan');

    const otdrId = 'OTDR-' + uuid().slice(0, 8).toUpperCase();
    const details: any[] = [];
    let totalQty = 0;

    for (const output of data.outputs) {
      const candidates = await this.stockService.findFefoCandidates(output.namaBarang, output.satuan, {
        idStock: output.idStock,
        nomorBatch: output.nomorBatch,
        lokasiRak: output.lokasiRak,
      });

      if (!candidates.length) throw new BadRequestException(`Stock tidak tersedia: ${output.namaBarang}`);

      const totalAvailable = candidates.reduce((sum, c) => sum + c.stockOnhand, 0);
      if (totalAvailable < output.qtyKeluar) {
        throw new BadRequestException(`Stock tidak cukup untuk ${output.namaBarang}. Tersedia: ${totalAvailable}, diminta: ${output.qtyKeluar}`);
      }

      let remaining = output.qtyKeluar;
      for (const candidate of candidates) {
        if (remaining <= 0) break;
        const deductQty = Math.min(remaining, candidate.stockOnhand);

        await this.bkRepo.save(this.bkRepo.create({
          tanggalDimuat: data.tglDimuat,
          kodeResto: resto.kode,
          namaResto: resto.nama,
          nopol: resto.nopol,
          waSopir: resto.wa,
          namaSopir: resto.sopir,
          namaBarang: output.namaBarang,
          qtyKeluar: deductQty,
          satuan: output.satuan,
          shiftOut: data.shiftOut,
          nomorSuratJalan: data.nomorSuratJalan,
          nomorITKirim: data.nomorITKirim || '',
          lokasiRak: candidate.lokasiRak,
          idStock: candidate.idStock,
          nomorBstb: candidate.nomorBstb,
          tanggalExpired: candidate.tanggalExpired,
          idOtdr: otdrId,
          keterangan: output.keterangan || data.keterangan || '',
          namaUserTransaksi: data.namaUserTransaksi,
          nomorBatch: candidate.nomorBatch,
        }));

        await this.stockService.deductOutbound(candidate.idStock, deductQty, data.namaUserTransaksi);

        const updatedStock = await this.stockService.findByIdStock(candidate.idStock);
        await this.mutasiService.logMutasi({
          jenisMutasi: 'OUT',
          tanggalTransaksi: data.tglDimuat,
          namaBarang: output.namaBarang,
          tanggalProduksi: candidate.tanggalProduksi,
          tanggalExpired: candidate.tanggalExpired,
          status: candidate.status,
          lokasiRak: candidate.lokasiRak,
          qtyMasuk: 0,
          qtyKeluar: deductQty,
          saldoAkhirLot: updatedStock?.stockOnhand || 0,
          satuan: output.satuan,
          idStock: candidate.idStock,
          nomorBstb: candidate.nomorBstb,
          nomorITKirim: data.nomorITKirim || '',
          kodeResto: resto.kode,
          namaResto: resto.nama,
          nomorSuratJalan: data.nomorSuratJalan,
          shiftKoordinator: data.shiftOut,
          namaUserTransaksi: data.namaUserTransaksi,
          keterangan: output.keterangan || '',
          nomorBatch: candidate.nomorBatch,
        });

        details.push({
          namaBarang: output.namaBarang,
          idStock: candidate.idStock,
          lokasiRak: candidate.lokasiRak,
          nomorBatch: candidate.nomorBatch,
          qtyDeducted: deductQty,
        });

        remaining -= deductQty;
        totalQty += deductQty;
      }
    }

    await this.otdrService.createDraft({
      idOtdr: otdrId,
      tanggalDimuat: data.tglDimuat,
      kodeResto: resto.kode,
      namaResto: resto.nama,
      nomorSuratJalan: data.nomorSuratJalan,
      nomorITKirim: data.nomorITKirim || '',
      nopol: resto.nopol,
      waSopir: resto.wa,
      namaSopir: resto.sopir,
      totalItem: data.outputs.length,
      totalQty,
      keterangan: data.keterangan || '',
      namaUserCreate: data.namaUserTransaksi,
    });

    await this.stockService.syncRelasiRakBatch();

    return {
      message: `Barang keluar berhasil. Tujuan: ${resto.kode} - ${resto.nama}. Total: ${data.outputs.length} item, ${totalQty} qty.`,
      otdrId,
      detail: details,
    };
  }

  async submitBarangKeluarFromPickingList(data: {
    nomorPO: string;
    restoId?: number;
    namaUserTransaksi: string;
  }) {
    const picks = await this.pickingRepo.find({
      where: { nomorPO: data.nomorPO, statusPicking: 'DRAFT PICKING' },
      order: { lokasiRak: 'ASC', tanggalExpired: 'ASC' },
    });
    if (!picks.length) throw new BadRequestException('Picking list tidak ditemukan atau sudah diproses');

    const first = picks[0];
    let restoId = data.restoId;
    if (!restoId) {
      const resto = await this.restoRepo.findOne({ where: { kode: first.kodeResto } });
      if (!resto) throw new BadRequestException('Resto tidak ditemukan untuk kode: ' + first.kodeResto);
      restoId = resto.id;
    }

    const byItem: Record<string, FgPickingList[]> = {};
    picks.forEach((p) => {
      if (!byItem[p.namaBarang]) byItem[p.namaBarang] = [];
      byItem[p.namaBarang].push(p);
    });

    const outputs = Object.entries(byItem).map(([namaBarang, rows]) => {
      const qty = rows.reduce((sum, r) => sum + r.qtyPick, 0);
      return {
        namaBarang,
        qtyKeluar: qty,
        satuan: rows[0].satuan,
        lokasiRak: rows[0].lokasiRak,
        idStock: rows[0].idStock,
        nomorBatch: rows[0].nomorBatch,
      };
    });

    const result = await this.submitBarangKeluar({
      tglDimuat: first.tanggalMuat,
      restoId,
      shiftOut: '',
      nomorSuratJalan: first.nomorSuratJalan || '',
      nomorITKirim: '',
      keterangan: `Dari picking list PO ${data.nomorPO}`,
      namaUserTransaksi: data.namaUserTransaksi,
      outputs,
    });

    for (const p of picks) {
      p.statusPicking = 'CLOSED';
      p.idOtdr = result.otdrId;
      p.timestampBarangKeluar = new Date().toISOString().split('T')[0];
      p.userBarangKeluar = data.namaUserTransaksi;
    }
    await this.pickingRepo.save(picks);

    return {
      ...result,
      message: `Barang keluar dari picking list ${data.nomorPO} berhasil. ${result.otdrId}`,
    };
  }

  async editQtyKeluar(data: {
    rowNumber: number;
    qtyBaru: number;
    alasan: string;
    namaUser: string;
  }) {
    const row = await this.bkRepo.findOne({ where: { id: data.rowNumber } });
    if (!row) throw new BadRequestException('Baris barang keluar tidak ditemukan');

    const oldQty = row.qtyKeluar;
    const delta = data.qtyBaru - oldQty;

    const stock = await this.stockService.findByIdStock(row.idStock);
    if (!stock) throw new BadRequestException('Stock tidak ditemukan: ' + row.idStock);

    const newQtyKeluar = stock.qtyKeluar + delta;
    const newOnhand = stock.stockOnhand - delta;
    if (newQtyKeluar < 0) throw new BadRequestException('Qty Keluar akan minus');
    if (newOnhand < 0) throw new BadRequestException('Stock tidak cukup');

    stock.qtyKeluar = newQtyKeluar;
    stock.stockOnhand = newOnhand;
    stock.namaUserInputTerakhir = data.namaUser;
    await this.stockService.save(stock);

    row.qtyKeluar = data.qtyBaru;
    await this.bkRepo.save(row);

    await this.logEditRepo.save(this.logEditRepo.create({
      rowBarangKeluar: data.rowNumber,
      tanggalDimuat: row.tanggalDimuat,
      kodeResto: row.kodeResto,
      namaResto: row.namaResto,
      nomorSuratJalan: row.nomorSuratJalan,
      idOtdr: row.idOtdr,
      namaBarang: row.namaBarang,
      idStock: row.idStock,
      nomorBatch: row.nomorBatch,
      lokasiRak: row.lokasiRak,
      qtyLama: oldQty,
      qtyBaru: data.qtyBaru,
      selisihQty: delta,
      stockOnhandSetelahEdit: newOnhand,
      alasanCatatan: data.alasan,
      dieditOleh: data.namaUser,
    }));

    return { message: `Edit berhasil. Qty ${oldQty} -> ${data.qtyBaru}. Stock onhand: ${newOnhand}` };
  }

  async checkNotice(data: {
    tglDimuat: string;
    restoId: number;
    nomorSuratJalan: string;
    outputs: Array<{
      namaBarang: string;
      qtyKeluar: number;
      satuan: string;
      lokasiRak?: string;
      idStock?: string;
      nomorBatch?: string;
    }>;
  }) {
    const notices: string[] = [];
    const resto = await this.restoRepo.findOne({ where: { id: data.restoId } });
    const kodeResto = resto?.kode || '';
    const namaResto = resto?.nama || '';

    const validOutputs = (data.outputs || []).filter((o) => o.namaBarang && o.qtyKeluar > 0);
    if (!validOutputs.length) {
      return { noticeType: 'BARANG_KELUAR', keyData: '', notices: [], hasNotice: false };
    }

    const keyData = [
      'OUT',
      data.tglDimuat,
      kodeResto,
      data.nomorSuratJalan,
      validOutputs.map((o) => `${o.namaBarang}:${o.qtyKeluar}:${o.idStock || o.nomorBatch || o.lokasiRak || 'FEFO'}`).join(';'),
    ].join('|');

    // 1. Duplicate lines within request
    const requestKeyMap: Record<string, number> = {};
    validOutputs.forEach((line, idx) => {
      const key = [
        line.namaBarang,
        line.satuan,
        line.idStock || '',
        line.nomorBatch || '',
        line.lokasiRak || 'FEFO',
      ].join('|').toUpperCase();
      if (requestKeyMap[key] !== undefined) {
        notices.push(
          `Output baris ${requestKeyMap[key] + 1} dan baris ${idx + 1} memakai barang/satuan/lot/rak yang sama. Gabungkan qty atau pastikan memang diperlukan agar tidak double deduction.`,
        );
      } else {
        requestKeyMap[key] = idx;
      }
    });

    // 2. Same SJ same resto same date already exists
    const sameSjRows = await this.bkRepo.find({
      where: {
        kodeResto,
        nomorSuratJalan: data.nomorSuratJalan,
        tanggalDimuat: data.tglDimuat,
      },
    });
    if (sameSjRows.length) {
      const items = Array.from(new Set(sameSjRows.map((r) => r.namaBarang).filter(Boolean)));
      notices.push(
        `Nomor Surat Jalan ${data.nomorSuratJalan} untuk ${kodeResto} - ${namaResto} pada tanggal dimuat yang sama sudah pernah dibuat ${sameSjRows.length} baris. Item sebelumnya: ${items.slice(0, 5).join(', ')}.`,
      );
    }

    // 3. Same line (barang + SJ + resto + date)
    for (let idx = 0; idx < validOutputs.length; idx++) {
      const line = validOutputs[idx];
      const candidates = await this.bkRepo.find({
        where: {
          kodeResto,
          nomorSuratJalan: data.nomorSuratJalan,
          namaBarang: line.namaBarang,
          satuan: line.satuan,
          tanggalDimuat: data.tglDimuat,
        },
      });
      const sameLineRows = candidates.filter((row) => {
        if (line.idStock) return row.idStock === line.idStock;
        if (line.nomorBatch && row.nomorBatch !== line.nomorBatch) return false;
        if (line.lokasiRak) return row.lokasiRak === line.lokasiRak;
        return true;
      });
      if (sameLineRows.length) {
        notices.push(
          `Output baris ${idx + 1} (${line.namaBarang}) mirip dengan data BARANG_KELUAR yang sudah ada pada SJ/tanggal/resto yang sama.`,
        );
      }

      // 4. Stock on hand is 0 for selected idStock
      if (line.idStock) {
        const stock = await this.stockService.findByIdStock(line.idStock);
        if (stock && stock.stockOnhand <= 0) {
          notices.push(
            `Output baris ${idx + 1} memilih ID Stock ${line.idStock} tetapi stock on hand sudah 0. Sistem akan menolak jika stok tidak tersedia.`,
          );
        }
      }
    }

    return {
      noticeType: 'BARANG_KELUAR',
      keyData,
      notices,
      hasNotice: notices.length > 0,
    };
  }

  async logNotice(data: {
    jenisTransaksi: string;
    levelNotice: string;
    keyData: string;
    pesanNotice: string;
    userKoordinator?: string;
    statusTindakan?: string;
  }) {
    return this.noticeRepo.save(
      this.noticeRepo.create({
        jenisTransaksi: data.jenisTransaksi,
        levelNotice: data.levelNotice,
        keyData: data.keyData,
        pesanNotice: data.pesanNotice,
        userKoordinator: data.userKoordinator || '',
        statusTindakan: data.statusTindakan || '',
      }),
    );
  }

  async rollback(id: number, namaUser: string) {
    const row = await this.bkRepo.findOne({ where: { id } });
    if (!row) throw new BadRequestException('Barang keluar tidak ditemukan');

    const stock = await this.stockService.findByIdStock(row.idStock);
    if (!stock) throw new BadRequestException('Stock tidak ditemukan untuk rollback');

    const newOnhand = stock.stockOnhand + row.qtyKeluar;
    const newQtyKeluar = stock.qtyKeluar - row.qtyKeluar;
    if (newQtyKeluar < 0) {
      throw new BadRequestException(`Tidak bisa rollback: qty keluar akan menjadi negatif (${newQtyKeluar}).`);
    }

    stock.stockOnhand = newOnhand;
    stock.qtyKeluar = newQtyKeluar;
    stock.namaUserInputTerakhir = namaUser;
    await this.stockService.save(stock);

    await this.mutasiService.logMutasi({
      jenisMutasi: 'ROLLBACK_OUT',
      tanggalTransaksi: row.tanggalDimuat,
      namaBarang: row.namaBarang,
      tanggalProduksi: stock.tanggalProduksi,
      tanggalExpired: row.tanggalExpired,
      status: stock.status,
      lokasiRak: row.lokasiRak,
      qtyMasuk: 0,
      qtyKeluar: -row.qtyKeluar,
      saldoAkhirLot: stock.stockOnhand,
      satuan: row.satuan,
      idStock: row.idStock,
      nomorBstb: row.nomorBstb,
      nomorITKirim: row.nomorITKirim || '',
      kodeResto: row.kodeResto,
      namaResto: row.namaResto,
      nomorSuratJalan: row.nomorSuratJalan,
      shiftKoordinator: row.shiftOut,
      namaUserTransaksi: namaUser,
      keterangan: `Rollback barang keluar id ${id}`,
      nomorBatch: row.nomorBatch,
    });

    const otdrId = row.idOtdr;
    await this.bkRepo.delete(id);

    // Jika tidak ada baris lain untuk OTDR yang sama, hapus OTDR-nya
    if (otdrId) {
      const remaining = await this.bkRepo.count({ where: { idOtdr: otdrId } });
      if (remaining === 0) {
        await this.otdrRepo.delete({ idOtdr: otdrId });
      }
    }

    await this.stockService.syncRelasiRakBatch();

    return {
      message: `Rollback barang keluar ${id} berhasil. Stock ${row.idStock} ditambah ${row.qtyKeluar}. On hand sekarang: ${stock.stockOnhand}.`,
    };
  }

  async getBarangKeluarList(startDate?: string, endDate?: string, keyword?: string) {
    const qb = this.bkRepo.createQueryBuilder('bk').orderBy('bk.timestampInput', 'DESC');
    if (startDate) qb.andWhere('bk.tanggalDimuat >= :start', { start: startDate });
    if (endDate) qb.andWhere('bk.tanggalDimuat <= :end', { end: endDate });
    if (keyword) {
      qb.andWhere('(bk.namaBarang LIKE :kw OR bk.kodeResto LIKE :kw OR bk.nomorSuratJalan LIKE :kw OR bk.idStock LIKE :kw)', { kw: `%${keyword}%` });
    }
    return qb.take(500).getMany();
  }
}
