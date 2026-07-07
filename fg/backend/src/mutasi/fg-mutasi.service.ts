import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgMutasi } from './fg-mutasi.entity.js';

@Injectable()
export class FgMutasiService {
  constructor(@InjectRepository(FgMutasi) private mutasiRepo: Repository<FgMutasi>) {}

  async logMutasi(data: {
    jenisMutasi: string;
    tanggalTransaksi: string;
    namaBarang: string;
    tanggalProduksi?: string;
    tanggalExpired?: string;
    status: string;
    lokasiRak: string;
    qtyMasuk: number;
    qtyKeluar: number;
    saldoAkhirLot: number;
    satuan: string;
    idStock: string;
    nomorBstb?: string;
    nomorITKirim?: string;
    kodeResto?: string;
    namaResto?: string;
    nomorSuratJalan?: string;
    shiftKoordinator: string;
    namaUserTransaksi: string;
    keterangan?: string;
    nomorBatch: string;
  }) {
    return this.mutasiRepo.save(this.mutasiRepo.create(data));
  }

  async getMutasiList(jenisMutasi?: string, startDate?: string, endDate?: string) {
    const qb = this.mutasiRepo.createQueryBuilder('m').orderBy('m.timestampInput', 'DESC');
    if (jenisMutasi) qb.andWhere('m.jenisMutasi = :jenis', { jenis: jenisMutasi });
    if (startDate) qb.andWhere('m.tanggalTransaksi >= :start', { start: startDate });
    if (endDate) qb.andWhere('m.tanggalTransaksi <= :end', { end: endDate });
    return qb.take(1000).getMany();
  }

  async getExportData(startDate: string, endDate: string) {
    return this.mutasiRepo.createQueryBuilder('m')
      .where('m.tanggalTransaksi BETWEEN :start AND :end', { start: startDate, end: endDate })
      .orderBy('m.tanggalTransaksi', 'ASC')
      .addOrderBy('m.namaBarang', 'ASC')
      .getMany();
  }
}
