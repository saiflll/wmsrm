import { Injectable } from '@nestjs/common';
import { FgStockService } from '../stock/fg-stock.service.js';

@Injectable()
export class FgQcFifoService {
  constructor(private stockService: FgStockService) {}

  async getMonitoring() {
    const stocks = await this.stockService.findAll(true);
    const today = new Date();

    const rows = stocks.map(item => {
      const days = item.tanggalExpired ? Math.ceil((new Date(item.tanggalExpired).getTime() - today.getTime()) / 86400000) : 999999;
      return {
        ...item,
        daysToExpired: days,
        statusQcKategori: item.status,
        bisaUpdateQcFifo: true,
      };
    }).sort((a, b) => {
      const byName = a.namaBarang.localeCompare(b.namaBarang);
      if (byName !== 0) return byName;
      return a.daysToExpired - b.daysToExpired;
    });

    return {
      rows,
      summary: {
        totalLot: rows.length,
        priorityLot: rows.filter(r => r.daysToExpired <= 30).length,
        expiredLot: rows.filter(r => r.daysToExpired < 0).length,
        holdLot: rows.filter(r => r.statusQcKategori === 'HOLD').length,
      },
    };
  }

  async updateStatus(idStock: string, statusBaru: string, namaUser: string) {
    const validStatuses = ['GOOD', 'HOLD', 'RELEASE', 'REJECT'];
    if (!validStatuses.includes(statusBaru)) throw new Error(`Status harus: ${validStatuses.join(', ')}`);
    const stock = await this.stockService.findByIdStock(idStock);
    if (!stock) throw new Error('Stock tidak ditemukan');
    stock.status = statusBaru;
    stock.namaUserInputTerakhir = namaUser;
    return this.stockService.save(stock);
  }
}
