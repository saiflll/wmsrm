import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgLogImportStock } from './fg-log-import-stock.entity.js';
import { FgStockService } from '../stock/fg-stock.service.js';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FgImportStockService {
  constructor(
    @InjectRepository(FgLogImportStock) private logRepo: Repository<FgLogImportStock>,
    private stockService: FgStockService,
  ) {}

  async importStock(data: {
    rows: Array<{
      namaBarang: string;
      tanggalProduksi: string;
      tanggalExpired?: string;
      qty: number;
      satuan: string;
      status: string;
      lokasiRak: string;
      nomorBstb?: string;
      nomorITKirim?: string;
      shiftKoordinator: string;
      keterangan?: string;
    }>;
    namaUser: string;
  }) {
    const idImport = 'IMP-' + uuid().slice(0, 8).toUpperCase();
    let successCount = 0;

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      try {
        const stock = await this.stockService.addInbound({
          namaBarang: row.namaBarang,
          tanggalProduksi: row.tanggalProduksi,
          tanggalExpired: row.tanggalExpired || '',
          status: row.status,
          lokasiRak: row.lokasiRak,
          qty: row.qty,
          satuan: row.satuan,
          nomorBstb: row.nomorBstb || '',
          tanggalBstb: row.tanggalProduksi,
          nomorITKirim: row.nomorITKirim || '',
          nomorBatch: 'IMPORT-' + (i + 1),
          namaUser: data.namaUser,
        });

        await this.logRepo.save(this.logRepo.create({
          idImport,
          barisTemplate: i + 1,
          namaBarang: row.namaBarang,
          tanggalProduksi: row.tanggalProduksi,
          tanggalExpired: row.tanggalExpired || '',
          status: row.status,
          lokasiRak: row.lokasiRak,
          qtyImport: row.qty,
          satuan: row.satuan,
          nomorBstb: row.nomorBstb || '',
          nomorITKirim: row.nomorITKirim || '',
          shiftKoordinator: row.shiftKoordinator,
          idStock: stock.idStock,
          statusImport: 'SUKSES',
          namaUserImport: data.namaUser,
        }));
        successCount++;
      } catch (err) {
        await this.logRepo.save(this.logRepo.create({
          idImport,
          barisTemplate: i + 1,
          namaBarang: row.namaBarang,
          tanggalProduksi: row.tanggalProduksi,
          tanggalExpired: row.tanggalExpired || '',
          status: row.status,
          lokasiRak: row.lokasiRak,
          qtyImport: row.qty,
          satuan: row.satuan,
          shiftKoordinator: row.shiftKoordinator,
          idStock: '',
          statusImport: 'GAGAL',
          pesan: err.message,
          namaUserImport: data.namaUser,
        }));
      }
    }

    await this.stockService.syncRelasiRakBatch();
    return { message: `Import selesai. Sukses: ${successCount}/${data.rows.length}`, idImport, successCount, total: data.rows.length };
  }
}
