import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Entities
import { User } from './admin/users/user.entity';
import { LoginLog } from './admin/users/login-log.entity';
import { Shift } from './master/shifts/shift.entity';
import { Suplayer } from './master/suplayers/suplayer.entity';
import { Barang } from './master/barang/barang.entity';
import { Gudang } from './master/gudang/gudang.entity';
import { Transaksi } from './transaksi/transaksi.entity';
import { Stock } from './management/inventory/stock.entity';
import { StockLog } from './management/inventory/stock-log.entity';
import { Customer } from './master/customers/customer.entity';
import { InboundPlanning } from './inbound/inbound-planning/inbound-planning.entity';
import { PlanningAyam } from './ayam/planning-ayam/planning-ayam.entity';
import { OutboundAyam } from './ayam/outbound-ayam/outbound-ayam.entity';
import { Relocation } from './management/relocation/relocation.entity';
import { PlanningOutbound } from './outbound/planning-outbound/planning-outbound.entity';

// Modules
import { AuthModule } from './admin/auth/auth.module';
import { UsersModule } from './admin/users/users.module';
import { BarangModule } from './master/barang/barang.module';
import { TransaksiModule } from './transaksi/transaksi.module';
import { GudangModule } from './master/gudang/gudang.module';
import { InventoryModule } from './management/inventory/inventory.module';
import { CustomersModule } from './master/customers/customers.module';
import { HardwareModule } from './hardware/hardware.module';
import { InboundPlanningModule } from './inbound/inbound-planning/inbound-planning.module';
import { PlanningAyamModule } from './ayam/planning-ayam/planning-ayam.module';
import { OutboundAyamModule } from './ayam/outbound-ayam/outbound-ayam.module';
import { RelocationModule } from './management/relocation/relocation.module';
import { PlanningOutboundModule } from './outbound/planning-outbound/planning-outbound.module';
import { ShiftsController } from './master/shifts/shifts.controller';

import { SeedService } from './seed.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [
          User,
          LoginLog,
          Shift,
          Suplayer,
          Barang,
          Gudang,
          Transaksi,
          Stock,
          StockLog,
          Customer,
          InboundPlanning,
          PlanningAyam,
          OutboundAyam,
          Relocation,
          PlanningOutbound,
        ],
        synchronize: process.env.NODE_ENV !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      Shift,
      Barang,
      Gudang,
      Suplayer,
      Customer,
      Transaksi,
      Stock,
      StockLog,
      PlanningAyam,
      OutboundAyam,
      InboundPlanning,
      Relocation,
      PlanningOutbound,
    ]),
    AuthModule,
    UsersModule,
    BarangModule,
    TransaksiModule,
    GudangModule,
    InventoryModule,
    CustomersModule,
    HardwareModule,
    InboundPlanningModule,
    PlanningAyamModule,
    OutboundAyamModule,
    RelocationModule,
    PlanningOutboundModule,
  ],
  controllers: [AppController, ShiftsController],
  providers: [
    AppService,
    SeedService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
