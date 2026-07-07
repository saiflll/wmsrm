import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgPickingList } from './fg-picking-list.entity.js';
import { FgStockService } from '../stock/fg-stock.service.js';
import { FgResto } from '../master-resto/fg-resto.entity.js';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FgPickingListService {
  constructor(
    @InjectRepository(FgPickingList) private pickingRepo: Repository<FgPickingList>,
    @InjectRepository(FgResto) private restoRepo: Repository<FgResto>,
    private stockService: FgStockService,
  ) {}

  async createPickingList(data: {
    nomorPO: string;
    tanggalMuat: string;
    kodeResto?: string;
    namaResto?: string;
    nopol?: string;
    namaSopir?: string;
    nomorSuratJalan?: string;
    catatan?: string;
    namaUser: string;
    items: Array<{ namaBarang: string; qtyPO: number; satuan: string }>;
  }) {
    const rows: FgPickingList[] = [];

    for (const item of data.items) {
      const candidates = await this.stockService.findFefoCandidates(item.namaBarang, item.satuan);
      if (!candidates.length) throw new BadRequestException(`Stock tidak tersedia: ${item.namaBarang}`);

      let remaining = item.qtyPO;
      for (const stock of candidates) {
        if (remaining <= 0) break;
        const qtyPick = Math.min(remaining, stock.stockOnhand);

        const picking = this.pickingRepo.create({
          nomorPO: data.nomorPO,
          tanggalMuat: data.tanggalMuat,
          kodeResto: data.kodeResto || '',
          namaResto: data.namaResto || '',
          nopol: data.nopol || '',
          namaSopir: data.namaSopir || '',
          nomorSuratJalan: data.nomorSuratJalan || '',
          namaBarang: item.namaBarang,
          qtyPO: item.qtyPO,
          qtyPick,
          satuan: item.satuan,
          lokasiRak: stock.lokasiRak,
          idStock: stock.idStock,
          nomorBatch: stock.nomorBatch,
          tanggalProduksi: stock.tanggalProduksi,
          tanggalExpired: stock.tanggalExpired,
          statusStock: stock.status,
          nomorBstb: stock.nomorBstb,
          statusPicking: 'DRAFT PICKING',
          catatan: data.catatan || '',
          dibuatOleh: data.namaUser,
          idPicking: 'PICK-' + uuid().slice(0, 8).toUpperCase(),
        });
        rows.push(picking);
        remaining -= qtyPick;
      }

      if (remaining > 0) throw new BadRequestException(`Stock tidak cukup untuk ${item.namaBarang}. Kekurangan: ${remaining}`);
    }

    const saved = await this.pickingRepo.save(rows);
    return { message: `Picking list PO ${data.nomorPO} dibuat: ${saved.length} baris`, count: saved.length };
  }

  async approve(nomorPO: string, items: { namaBarang: string; qtyPo: number }[], username: string) {
    const rows = await this.pickingRepo.find({ where: { nomorPO } });
    if (!rows.length) throw new BadRequestException('Picking list tidak ditemukan: ' + nomorPO);

    if (items.length) {
      items.forEach((item) => {
        const filtered = rows.filter((r) => r.namaBarang === item.namaBarang);
        filtered.forEach((r) => {
          r.qtyPO = item.qtyPo;
        });
      });
    }

    rows.forEach((r) => {
      r.statusPicking = 'APPROVED';
    });

    return this.pickingRepo.save(rows);
  }

  async getPickingList(nomorPO?: string, startDate?: string, endDate?: string) {
    const qb = this.pickingRepo.createQueryBuilder('p').orderBy('p.nomorPO', 'ASC').addOrderBy('p.lokasiRak', 'ASC');
    if (nomorPO) qb.andWhere('p.nomorPO = :po', { po: nomorPO });
    if (startDate) qb.andWhere('p.tanggalMuat >= :start', { start: startDate });
    if (endDate) qb.andWhere('p.tanggalMuat <= :end', { end: endDate });
    return qb.getMany();
  }

  async getPrintData(nomorPO: string) {
    const rows = await this.pickingRepo.find({ where: { nomorPO }, order: { lokasiRak: 'ASC', tanggalExpired: 'ASC' } });
    if (!rows.length) throw new BadRequestException('Tidak ada data picking untuk PO: ' + nomorPO);

    const totalQtyPO = rows.reduce((sum, r) => Math.max(sum, r.qtyPO), 0);
    const totalQtyPick = rows.reduce((sum, r) => sum + r.qtyPick, 0);

    return {
      nomorPO,
      rows,
      totalRows: rows.length,
      totalQtyPO,
      totalQtyPick,
    };
  }
}
