import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgLogLokasi } from './fg-log-lokasi.entity.js';
import { FgStockService } from '../stock/fg-stock.service.js';

@Injectable()
export class FgUpdateLokasiService {
  constructor(
    @InjectRepository(FgLogLokasi) private logRepo: Repository<FgLogLokasi>,
    private stockService: FgStockService,
  ) {}

  async updateLokasi(data: {
    idStock: string;
    lokasiBaru: string;
    statusBaru?: string;
    picKoordinator: string;
    keterangan?: string;
    namaUser: string;
  }) {
    const stock = await this.stockService.findByIdStock(data.idStock);
    if (!stock) throw new Error('Stock tidak ditemukan');

    const lokasiLama = stock.lokasiRak;
    const statusLama = stock.status;

    await this.stockService.updateLocation(data.idStock, data.lokasiBaru, data.statusBaru || '', data.namaUser, data.keterangan || '');

    await this.logRepo.save(this.logRepo.create({
      idStock: data.idStock,
      namaBarang: stock.namaBarang,
      lokasiLama,
      lokasiBaru: data.lokasiBaru,
      statusLama,
      statusBaru: data.statusBaru || statusLama,
      picKoordinator: data.picKoordinator,
      keterangan: data.keterangan || '',
      namaUserUpdate: data.namaUser,
    }));

    await this.stockService.syncRelasiRakBatch();
    return { message: `Lokasi ${data.idStock} diubah: ${lokasiLama} -> ${data.lokasiBaru}` };
  }

  async getLog(idStock?: string) {
    const where: any = {};
    if (idStock) where.idStock = idStock;
    return this.logRepo.find({ where, order: { timestampUpdate: 'DESC' }, take: 500 });
  }

  async bulkUpdateLokasi(data: {
    items: { idStock: string; statusBaru?: string; keterangan?: string }[];
    lokasiBaru: string;
    picKoordinator: string;
    namaUser: string;
  }) {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of data.items) {
      try {
        const stock = await this.stockService.findByIdStock(item.idStock);
        if (!stock) { failed++; errors.push(`${item.idStock}: Stock tidak ditemukan`); continue; }

        const lokasiLama = stock.lokasiRak;
        const statusLama = stock.status;
        const targetLokasi = data.lokasiBaru === 'SAMA' ? lokasiLama : data.lokasiBaru;

        await this.stockService.updateLocation(item.idStock, targetLokasi, item.statusBaru || '', data.namaUser, item.keterangan || '');

        await this.logRepo.save(this.logRepo.create({
          idStock: item.idStock,
          namaBarang: stock.namaBarang,
          lokasiLama,
          lokasiBaru: targetLokasi,
          statusLama,
          statusBaru: item.statusBaru || statusLama,
          picKoordinator: data.picKoordinator,
          keterangan: item.keterangan || '',
          namaUserUpdate: data.namaUser,
        }));
        success++;
      } catch (e: any) {
        failed++;
        errors.push(`${item.idStock}: ${e.message}`);
      }
    }

    await this.stockService.syncRelasiRakBatch();
    return { message: `Relokasi: ${success} berhasil, ${failed} gagal`, success, failed, errors };
  }
}
