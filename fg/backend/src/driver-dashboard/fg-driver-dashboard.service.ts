import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgOtdrEvidence } from './fg-otdr-evidence.entity.js';
import { FgOtdrService } from '../otdr/fg-otdr.service.js';

@Injectable()
export class FgDriverDashboardService {
  constructor(
    @InjectRepository(FgOtdrEvidence) private evidenceRepo: Repository<FgOtdrEvidence>,
    private otdrService: FgOtdrService,
  ) {}

  async getDashboard(token: string) {
    const otdr = await this.otdrService.findByToken(token);
    if (!otdr) throw new BadRequestException('Token tidak valid');
    return otdr;
  }

  async submitEvidence(token: string, data: {
    statusTerima: string;
    namaPenerima: string;
    namaChecker: string;
    statusChecker: string;
    linkBuktiFoto: string;
    catatanBuktiTerima: string;
    userAgent?: string;
  }) {
    const otdr = await this.otdrService.findByToken(token);
    if (!otdr) throw new BadRequestException('Token tidak valid');

    await this.evidenceRepo.save(this.evidenceRepo.create({
      idOtdr: otdr.idOtdr,
      tanggalDimuat: otdr.tanggalDimuat,
      kodeResto: otdr.kodeResto,
      namaResto: otdr.namaResto,
      nomorSuratJalan: otdr.nomorSuratJalan,
      nopol: otdr.nopol,
      waSopir: otdr.waSopir,
      namaSopir: otdr.namaSopir,
      statusTerimaSopir: data.statusTerima,
      namaPenerima: data.namaPenerima,
      namaChecker: data.namaChecker,
      statusChecker: data.statusChecker,
      linkBuktiFoto: data.linkBuktiFoto,
      catatanBuktiTerima: data.catatanBuktiTerima,
      userAgentSumber: data.userAgent || 'WEB',
    }));

    return this.otdrService.submitDriverEvidence(token, data);
  }
}
