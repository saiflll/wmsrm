import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgAdminIT } from './fg-admin-it.entity.js';
import { FgBarangMasuk } from '../barang-masuk/fg-barang-masuk.entity.js';
import { FgBarangKeluar } from '../barang-keluar/fg-barang-keluar.entity.js';
import { FgStock } from '../stock/fg-stock.entity.js';
import { FgMutasi } from '../mutasi/fg-mutasi.entity.js';
import { FgOtdr } from '../otdr/fg-otdr.entity.js';

@Injectable()
export class FgAdminItService {
  constructor(
    @InjectRepository(FgAdminIT) private adminItRepo: Repository<FgAdminIT>,
    @InjectRepository(FgBarangMasuk) private bmRepo: Repository<FgBarangMasuk>,
    @InjectRepository(FgBarangKeluar) private bkRepo: Repository<FgBarangKeluar>,
    @InjectRepository(FgStock) private stockRepo: Repository<FgStock>,
    @InjectRepository(FgMutasi) private mutasiRepo: Repository<FgMutasi>,
    @InjectRepository(FgOtdr) private otdrRepo: Repository<FgOtdr>,
  ) {}

  async submitRows(data: { rows: any[]; namaUser: string }) {
    const rows = data.rows.filter(r => r.nomorITTerima || r.nomorITKirim);
    if (!rows.length) throw new BadRequestException('Minimal 1 baris nomor IT');

    const saved = rows.map(r => this.adminItRepo.create({
      tanggalIT: r.tanggalIT,
      jenisIT: r.jenisIT,
      nomorITTerima: r.nomorITTerima || '',
      nomorITKirim: r.nomorITKirim || '',
      nomorReferensiDokumen: r.nomorReferensi || '',
      kodeRestoSupplier: r.kodeRestoSupplier || '',
      namaBarangKeterangan: r.namaBarangKet || '',
      qty: r.qty || '',
      catatanAdmin: r.catatan || '',
      namaAdminInput: data.namaUser,
      sumberRelasi: 'MANUAL',
      statusRelasi: 'TERSIMPAN MANUAL',
    }));

    await this.adminItRepo.save(saved);
    return { message: `${saved.length} baris nomor IT disimpan`, count: saved.length };
  }

  async getList(startDate?: string, endDate?: string) {
    const qb = this.adminItRepo.createQueryBuilder('a').orderBy('a.tanggalIT', 'DESC');
    if (startDate) qb.andWhere('a.tanggalIT >= :start', { start: startDate });
    if (endDate) qb.andWhere('a.tanggalIT <= :end', { end: endDate });
    return qb.take(100).getMany();
  }

  async getTransactions(data: { startDate?: string; endDate?: string; jenis?: string }) {
    const jenis = (data.jenis || 'BOTH').toUpperCase();
    const result: any = {};

    if (jenis === 'BOTH' || jenis === 'MASUK') {
      const qb = this.bmRepo.createQueryBuilder('bm').orderBy('bm.timestampInput', 'DESC');
      if (data.startDate) qb.andWhere('bm.tanggalBstb >= :start', { start: data.startDate });
      if (data.endDate) qb.andWhere('bm.tanggalBstb <= :end', { end: data.endDate });
      result.masuk = await qb.take(200).getMany();
    }

    if (jenis === 'BOTH' || jenis === 'KELUAR') {
      const qb = this.bkRepo.createQueryBuilder('bk').orderBy('bk.timestampInput', 'DESC');
      if (data.startDate) qb.andWhere('bk.tanggalDimuat >= :start', { start: data.startDate });
      if (data.endDate) qb.andWhere('bk.tanggalDimuat <= :end', { end: data.endDate });
      result.keluar = await qb.take(200).getMany();
    }

    return result;
  }

  async updateBarangMasukITTerima(id: number, nomorITTerima: string, admin: string) {
    const row = await this.bmRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Barang masuk tidak ditemukan');
    const tanggalUpdate = new Date().toISOString().split('T')[0];

    row.nomorITTerima = nomorITTerima;
    row.tanggalUpdateITTerima = tanggalUpdate;
    row.adminUpdateITTerima = admin;
    await this.bmRepo.save(row);

    // Propagate to stock
    await this.stockRepo.update(
      {
        namaBarang: row.namaBarang,
        nomorBatch: row.nomorBatch,
        lokasiRak: row.lokasiRak,
        nomorBstb: row.nomorBstb,
      },
      {
        nomorITTerimaTerakhir: nomorITTerima,
        lastUpdateITTerima: tanggalUpdate,
        adminITTerima: admin,
      },
    );

    // Propagate to mutasi IN records
    await this.mutasiRepo.update(
      {
        jenisMutasi: 'IN',
        namaBarang: row.namaBarang,
        nomorBatch: row.nomorBatch,
        lokasiRak: row.lokasiRak,
        nomorBstb: row.nomorBstb,
      },
      {
        nomorITTerima: nomorITTerima,
        timestampUpdateIT: tanggalUpdate,
        adminUpdateIT: admin,
      },
    );

    return { message: `IT Terima ${nomorITTerima} disimpan untuk barang masuk ${id} beserta stock & mutasi terkait` };
  }

  async updateBarangKeluarITKirim(id: number, nomorITKirim: string, admin: string) {
    const row = await this.bkRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Barang keluar tidak ditemukan');
    const tanggalUpdate = new Date().toISOString().split('T')[0];

    row.nomorITKirim = nomorITKirim;
    row.tanggalUpdateITKirim = tanggalUpdate;
    row.adminUpdateITKirim = admin;
    await this.bkRepo.save(row);

    // Propagate to OTDR
    if (row.idOtdr) {
      await this.otdrRepo.update(
        { idOtdr: row.idOtdr },
        { nomorITKirim: nomorITKirim },
      );
    }

    // Propagate to mutasi OUT records
    await this.mutasiRepo.update(
      {
        jenisMutasi: 'OUT',
        idStock: row.idStock,
        nomorSuratJalan: row.nomorSuratJalan,
      },
      {
        nomorITKirim: nomorITKirim,
        timestampUpdateIT: tanggalUpdate,
        adminUpdateIT: admin,
      },
    );

    return { message: `IT Kirim ${nomorITKirim} disimpan untuk barang keluar ${id} beserta OTDR & mutasi terkait` };
  }
}
