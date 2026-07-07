import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from './barang.entity';
import { BarangController } from './barang.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Barang])],
    controllers: [BarangController],
    exports: [TypeOrmModule],
})
export class BarangModule { }
