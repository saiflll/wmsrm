import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgStockOpname } from './fg-stock-opname.entity.js';
import { FgStockOpnameItem } from './fg-stock-opname-item.entity.js';
import { FgStockService } from '../stock/fg-stock.service.js';
import { FgMutasiService } from '../mutasi/fg-mutasi.service.js';

@Injectable()
export class FgStockOpnameService {
  constructor(
    @InjectRepository(FgStockOpname) private opnameRepo: Repository<FgStockOpname>,
    @InjectRepository(FgStockOpnameItem) private itemRepo: Repository<FgStockOpnameItem>,
    private stockService: FgStockService,
    private mutasiService: FgMutasiService,
  ) {}

  async submit(data: {
    tanggalOpname: string;
    diajukanOleh: string;
    namaInventory: string;
    namaSupervisor: string;
    namaAdmin: string;
    catatan?: string;
    items: {
      idStock: string;
      namaBarang: string;
      lokasiRak: string;
      nomorBatch: string;
      tanggalExpired: string;
      qtySistem: number;
      qtyActual: number;
      selisih: number;
      statusOpname: string;
    }[];
  }) {
    const opname = await this.opnameRepo.save(this.opnameRepo.create({
      tanggalOpname: data.tanggalOpname,
      status: 'MENUNGGU',
      diajukanOleh: data.diajukanOleh,
      namaInventory: data.namaInventory || '',
      namaSupervisor: data.namaSupervisor || '',
      namaAdmin: data.namaAdmin || '',
      catatan: data.catatan || '',
    }));

    const items = data.items.map((item) => this.itemRepo.create({
      stockOpnameId: opname.id,
      ...item,
    }));
    await this.itemRepo.save(items);

    return this.findOne(opname.id);
  }

  async findAll() {
    const opnames = await this.opnameRepo.find({ order: { createdAt: 'DESC' } });
    const result = [];
    for (const o of opnames) {
      const items = await this.itemRepo.find({ where: { stockOpnameId: o.id } });
      result.push({ ...o, items });
    }
    return result;
  }

  async findOne(id: number) {
    const opname = await this.opnameRepo.findOne({ where: { id } });
    if (!opname) return null;
    const items = await this.itemRepo.find({ where: { stockOpnameId: id } });
    return { ...opname, items };
  }

  async approve(id: number, disetujuiOleh: string) {
    const opname = await this.opnameRepo.findOne({ where: { id } });
    if (!opname) throw new Error('Opname tidak ditemukan');
    if (opname.status !== 'MENUNGGU') throw new Error(`Status opname sudah ${opname.status}`);

    const items = await this.itemRepo.find({ where: { stockOpnameId: id } });

    for (const item of items) {
      if (item.selisih === 0) continue;

      const stock = await this.stockService.findByIdStock(item.idStock);
      if (!stock) continue;

      const updated = await this.stockService.adjustQuantity(item.idStock, item.qtyActual);

      await this.mutasiService.logMutasi({
        jenisMutasi: 'OPNAME',
        tanggalTransaksi: opname.tanggalOpname,
        namaBarang: item.namaBarang,
        status: stock.status,
        lokasiRak: item.lokasiRak,
        qtyMasuk: item.selisih > 0 ? item.selisih : 0,
        qtyKeluar: item.selisih < 0 ? Math.abs(item.selisih) : 0,
        saldoAkhirLot: updated.stockOnhand,
        satuan: stock.satuan,
        idStock: item.idStock,
        nomorBatch: item.nomorBatch,
        shiftKoordinator: 'OPNAME',
        namaUserTransaksi: disetujuiOleh,
        keterangan: `Penyesuaian opname: sistem ${item.qtySistem} -> actual ${item.qtyActual}`,
      });
    }

    opname.status = 'DISETUJUI';
    opname.disetujuiOleh = disetujuiOleh;
    await this.opnameRepo.save(opname);

    return this.findOne(id);
  }

  async reject(id: number, catatan?: string) {
    const opname = await this.opnameRepo.findOne({ where: { id } });
    if (!opname) throw new Error('Opname tidak ditemukan');
    if (opname.status !== 'MENUNGGU') throw new Error(`Status opname sudah ${opname.status}`);

    opname.status = 'DITOLAK';
    if (catatan) opname.catatan = catatan;
    await this.opnameRepo.save(opname);

    return this.findOne(id);
  }

  async uploadPdf(id: number, pdfPath: string) {
    const opname = await this.opnameRepo.findOne({ where: { id } });
    if (!opname) throw new Error('Opname tidak ditemukan');
    opname.pdfPath = pdfPath;
    await this.opnameRepo.save(opname);
    return this.findOne(id);
  }

  async delete(id: number) {
    await this.itemRepo.delete({ stockOpnameId: id });
    await this.opnameRepo.delete(id);
    return { message: 'Opname dihapus' };
  }
}
