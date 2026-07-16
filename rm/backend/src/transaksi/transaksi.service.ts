import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaksi } from './transaksi.entity';

@Injectable()
export class TransaksiService {
  constructor(
    @InjectRepository(Transaksi)
    private readonly transaksiRepo: Repository<Transaksi>,
  ) {}

  findAll() {
    return this.transaksiRepo.find({
      relations: ['barang', 'suplayer', 'gudang', 'user'],
    });
  }

  create(data: Partial<Transaksi>) {
    const trx = this.transaksiRepo.create(data);
    return this.transaksiRepo.save(trx);
  }
}
