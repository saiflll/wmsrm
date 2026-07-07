import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { FgBarang } from "./master-barang/fg-barang.entity.js";
import { FgStatus } from "./master-status/fg-status.entity.js";
import { FgRak } from "./master-rak/fg-rak.entity.js";
import { FgResto } from "./master-resto/fg-resto.entity.js";
import { FgKoordinator } from "./master-koordinator/fg-koordinator.entity.js";
import { FgUser } from "./users/fg-user.entity.js";
import { FgBarangMasuk } from "./barang-masuk/fg-barang-masuk.entity.js";
import { FgNoticeTransaksi } from "./barang-masuk/fg-notice-transaksi.entity.js";
import { FgBarangKeluar } from "./barang-keluar/fg-barang-keluar.entity.js";
import { FgLogEditBarangKeluar } from "./barang-keluar/fg-log-edit-barang-keluar.entity.js";
import { FgStock } from "./stock/fg-stock.entity.js";
import { FgRelasiRakBatch } from "./stock/fg-relasi-rak-batch.entity.js";
import { FgMutasi } from "./mutasi/fg-mutasi.entity.js";
import { FgOtdr } from "./otdr/fg-otdr.entity.js";
import { FgOtdrEvidence } from "./driver-dashboard/fg-otdr-evidence.entity.js";
import { FgPickingList } from "./picking-list/fg-picking-list.entity.js";
import { FgLogLokasi } from "./update-lokasi/fg-log-lokasi.entity.js";
import { FgAdminIT } from "./admin-it/fg-admin-it.entity.js";
import { FgLogImportStock } from "./import-stock/fg-log-import-stock.entity.js";
import { FgStockOpname } from "./stock-opname/fg-stock-opname.entity.js";
import { FgStockOpnameItem } from "./stock-opname/fg-stock-opname-item.entity.js";

import { FgAuthModule } from "./auth/fg-auth.module.js";
import { FgUsersModule } from "./users/fg-users.module.js";
import { FgMasterBarangModule } from "./master-barang/fg-master-barang.module.js";
import { FgMasterStatusModule } from "./master-status/fg-master-status.module.js";
import { FgMasterRakModule } from "./master-rak/fg-master-rak.module.js";
import { FgMasterRestoModule } from "./master-resto/fg-master-resto.module.js";
import { FgMasterKoordinatorModule } from "./master-koordinator/fg-master-koordinator.module.js";
import { FgStockModule } from "./stock/fg-stock.module.js";
import { FgBarangMasukModule } from "./barang-masuk/fg-barang-masuk.module.js";
import { FgBarangKeluarModule } from "./barang-keluar/fg-barang-keluar.module.js";
import { FgOtdrModule } from "./otdr/fg-otdr.module.js";
import { FgPickingListModule } from "./picking-list/fg-picking-list.module.js";
import { FgMutasiModule } from "./mutasi/fg-mutasi.module.js";
import { FgQcFifoModule } from "./qc-fifo/fg-qc-fifo.module.js";
import { FgUpdateLokasiModule } from "./update-lokasi/fg-update-lokasi.module.js";
import { FgAdminItModule } from "./admin-it/fg-admin-it.module.js";
import { FgImportStockModule } from "./import-stock/fg-import-stock.module.js";
import { FgDriverDashboardModule } from "./driver-dashboard/fg-driver-dashboard.module.js";
import { FgReportModule } from "./report/fg-report.module.js";
import { FgStockOpnameModule } from "./stock-opname/fg-stock-opname.module.js";

import { FgUsersService } from "./users/fg-users.service.js";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

const ALL_ENTITIES = [
  FgBarang,
  FgStatus,
  FgRak,
  FgResto,
  FgKoordinator,
  FgUser,
  FgBarangMasuk,
  FgNoticeTransaksi,
  FgBarangKeluar,
  FgLogEditBarangKeluar,
  FgStock,
  FgRelasiRakBatch,
  FgMutasi,
  FgOtdr,
  FgOtdrEvidence,
  FgPickingList,
  FgLogLokasi,
  FgAdminIT,
  FgLogImportStock,
  FgStockOpname,
  FgStockOpnameItem,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        url: configService.get("DATABASE_URL"),
        entities: ALL_ENTITIES,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    FgAuthModule,
    FgUsersModule,
    FgMasterBarangModule,
    FgMasterStatusModule,
    FgMasterRakModule,
    FgMasterRestoModule,
    FgMasterKoordinatorModule,
    FgStockModule,
    FgMutasiModule,
    FgOtdrModule,
    FgBarangMasukModule,
    FgBarangKeluarModule,
    FgPickingListModule,
    FgQcFifoModule,
    FgUpdateLokasiModule,
    FgAdminItModule,
    FgImportStockModule,
    FgDriverDashboardModule,
    FgReportModule,
  FgStockOpnameModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private usersService: FgUsersService,
    @InjectRepository(FgStatus) private statusRepo: Repository<FgStatus>,
  ) {}

  async onModuleInit() {
    await this.usersService.seedDefaults();
    await this.seedStatus();
  }

  private async seedStatus() {
    const count = await this.statusRepo.count();
    if (count > 0) return;
    const statuses = ["GOOD", "REJECT", "HOLD", "RELEASE", "EXP", "DAMAGE"];
    await this.statusRepo.save(
      statuses.map((s) => this.statusRepo.create({ status: s })),
    );
    console.log("✅ Seed status");
  }
}
