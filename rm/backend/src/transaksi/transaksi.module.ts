import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaksi } from './transaksi.entity';
import { TransaksiController } from './transaksi.controller';
import { TransaksiService } from './transaksi.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaksi])],
  controllers: [TransaksiController],
  providers: [TransaksiService],
  exports: [TransaksiService],
})
export class TransaksiModule {}
