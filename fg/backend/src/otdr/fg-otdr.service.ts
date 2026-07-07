import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgOtdr } from './fg-otdr.entity.js';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FgOtdrService {
  constructor(@InjectRepository(FgOtdr) private otdrRepo: Repository<FgOtdr>) {}

  async createDraft(data: {
    idOtdr: string;
    tanggalDimuat: string;
    kodeResto: string;
    namaResto: string;
    nomorSuratJalan: string;
    nomorITKirim: string;
    nopol: string;
    waSopir: string;
    namaSopir: string;
    totalItem: number;
    totalQty: number;
    keterangan: string;
    namaUserCreate: string;
  }) {
    const token = uuid();
    const otdr = this.otdrRepo.create({
      ...data,
      statusOtdr: 'DRAFT',
      tokenDashboardSopir: token,
      linkDashboardSopir: `/driver-dashboard?token=${token}`,
    });
    return this.otdrRepo.save(otdr);
  }

  async updateMuat(idOtdr: string, data: {
    startMuat?: string;
    selesaiMuat?: string;
    namaNamaYangMuat?: string;
    nopol?: string;
    waSopir?: string;
    namaSopir?: string;
    catatan?: string;
    namaUserUpdate: string;
  }) {
    const otdr = await this.otdrRepo.findOne({ where: { idOtdr } });
    if (!otdr) throw new Error('OTDR tidak ditemukan');

    if (data.startMuat) otdr.startMuat = data.startMuat;
    if (data.selesaiMuat) otdr.selesaiMuat = data.selesaiMuat;
    if (data.namaNamaYangMuat) otdr.namaNamaYangMuat = data.namaNamaYangMuat;
    if (data.nopol) otdr.nopol = data.nopol;
    if (data.waSopir) otdr.waSopir = data.waSopir;
    if (data.namaSopir) otdr.namaSopir = data.namaSopir;
    if (data.catatan) otdr.catatan = data.catatan;
    otdr.namaUserUpdate = data.namaUserUpdate;

    return this.otdrRepo.save(otdr);
  }

  async markComplete(idOtdr: string, namaUser: string) {
    const otdr = await this.otdrRepo.findOne({ where: { idOtdr } });
    if (!otdr) throw new Error('OTDR tidak ditemukan');
    otdr.statusOtdr = 'COMPLETE';
    otdr.namaUserUpdate = namaUser;
    return this.otdrRepo.save(otdr);
  }

  async findByToken(token: string) {
    return this.otdrRepo.findOne({ where: { tokenDashboardSopir: token } });
  }

  async submitDriverEvidence(token: string, data: {
    statusTerima: string;
    namaPenerima: string;
    namaChecker: string;
    statusChecker: string;
    linkBuktiFoto: string;
    catatanBuktiTerima: string;
  }) {
    const otdr = await this.findByToken(token);
    if (!otdr) throw new Error('Token dashboard sopir tidak valid');

    otdr.statusTerimaSopir = data.statusTerima;
    otdr.tanggalTerimaSopir = new Date().toISOString().split('T')[0];
    otdr.namaPenerima = data.namaPenerima;
    otdr.namaChecker = data.namaChecker;
    otdr.statusChecker = data.statusChecker;
    otdr.linkBuktiFoto = data.linkBuktiFoto;
    otdr.catatanBuktiTerima = data.catatanBuktiTerima;

    if (data.statusTerima === 'DITERIMA' && data.statusChecker === 'SESUAI') {
      otdr.statusOtdr = 'COMPLETE';
    }

    return this.otdrRepo.save(otdr);
  }

  async getOtdrList(status?: string) {
    const where: any = {};
    if (status) where.statusOtdr = status;
    return this.otdrRepo.find({ where, order: { timestampCreate: 'DESC' } });
  }

  async getSummary() {
    const all = await this.otdrRepo.find();
    const total = all.length;
    const draft = all.filter((o) => o.statusOtdr === 'DRAFT').length;
    const complete = all.filter((o) => o.statusOtdr === 'COMPLETE').length;
    const inProgress = all.filter((o) => o.startMuat && !o.selesaiMuat).length;
    const totalItem = all.reduce((sum, o) => sum + (o.totalItemOutput || 0), 0);
    const totalQty = all.reduce((sum, o) => sum + (o.totalQtyOutput || 0), 0);
    return {
      total,
      draft,
      complete,
      inProgress,
      totalItem,
      totalQty,
      recent: all.slice(0, 10),
    };
  }
}
