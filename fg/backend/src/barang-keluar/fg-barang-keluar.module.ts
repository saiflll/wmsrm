import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FgBarangKeluar } from "./fg-barang-keluar.entity.js";
import { FgLogEditBarangKeluar } from "./fg-log-edit-barang-keluar.entity.js";
import { FgBarangKeluarService } from "./fg-barang-keluar.service.js";
import { FgBarangKeluarController } from "./fg-barang-keluar.controller.js";
import { FgPickingList } from "../picking-list/fg-picking-list.entity.js";
import { FgNoticeTransaksi } from "../barang-masuk/fg-notice-transaksi.entity.js";
import { FgOtdr } from "../otdr/fg-otdr.entity.js";
import { FgStockModule } from "../stock/fg-stock.module.js";
import { FgMutasiModule } from "../mutasi/fg-mutasi.module.js";
import { FgOtdrModule } from "../otdr/fg-otdr.module.js";
import { FgMasterRestoModule } from "../master-resto/fg-master-resto.module.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([FgBarangKeluar, FgLogEditBarangKeluar, FgPickingList, FgNoticeTransaksi, FgOtdr]),
    FgStockModule,
    FgMutasiModule,
    FgOtdrModule,
    FgMasterRestoModule,
  ],
  controllers: [FgBarangKeluarController],
  providers: [FgBarangKeluarService],
  exports: [FgBarangKeluarService],
})
export class FgBarangKeluarModule {}
