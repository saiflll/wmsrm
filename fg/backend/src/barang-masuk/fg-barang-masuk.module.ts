import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FgBarangMasuk } from "./fg-barang-masuk.entity.js";
import { FgNoticeTransaksi } from "./fg-notice-transaksi.entity.js";
import { FgBarangMasukService } from "./fg-barang-masuk.service.js";
import { FgBarangMasukController } from "./fg-barang-masuk.controller.js";
import { FgStockModule } from "../stock/fg-stock.module.js";
import { FgMutasiModule } from "../mutasi/fg-mutasi.module.js";
import { FgMasterBarangModule } from "../master-barang/fg-master-barang.module.js";
import { FgRak } from "../master-rak/fg-rak.entity.js";
import { FgStock } from "../stock/fg-stock.entity.js";
import { FgBarangKeluar } from "../barang-keluar/fg-barang-keluar.entity.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FgBarangMasuk,
      FgNoticeTransaksi,
      FgRak,
      FgStock,
      FgBarangKeluar,
    ]),
    FgStockModule,
    FgMutasiModule,
    FgMasterBarangModule,
  ],
  controllers: [FgBarangMasukController],
  providers: [FgBarangMasukService],
  exports: [FgBarangMasukService],
})
export class FgBarangMasukModule {}
