import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaksi } from './transaksi.entity';

@Injectable()
export class TransaksiService {
  constructor(
    @InjectRepository(Transaksi)
    private readonly transaksi_repo: Repository<Transaksi>,
  ) {}

  find_all() {
    return this.transaksi_repo.find({
      relations: ['barang', 'suplayer', 'gudang', 'user'],
    });
  }

  create(data: Partial<Transaksi>) {
    const trx = this.transaksi_repo.create(data);
    return this.transaksi_repo.save(trx);
  }
}
