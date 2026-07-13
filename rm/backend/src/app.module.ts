import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Entities
import { User } from './users/user.entity';
import { LoginLog } from './users/login-log.entity';
import { Shift } from './shifts/shift.entity';
import { Suplayer } from './suplayers/suplayer.entity';
import { Barang } from './barang/barang.entity';
import { Gudang } from './gudang/gudang.entity';
import { Transaksi } from './transaksi/transaksi.entity';
import { Stock } from './inventory/stock.entity';
import { StockLog } from './inventory/stock-log.entity';
import { Customer } from './customers/customer.entity';
import { InboundPlanning } from './inbound-planning/inbound-planning.entity';
import { PlanningAyam } from './planning-ayam/planning-ayam.entity';
import { OutboundAyam } from './outbound-ayam/outbound-ayam.entity';

// Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BarangModule } from './barang/barang.module';
import { TransaksiModule } from './transaksi/transaksi.module';
import { GudangModule } from './gudang/gudang.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { HardwareModule } from './hardware/hardware.module';
import { InboundPlanningModule } from './inbound-planning/inbound-planning.module';
import { PlanningAyamModule } from './planning-ayam/planning-ayam.module';
import { OutboundAyamModule } from './outbound-ayam/outbound-ayam.module';
import { ShiftsController } from './shifts/shifts.controller';

import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [User, LoginLog, Shift, Suplayer, Barang, Gudang, Transaksi, Stock, StockLog, Customer, InboundPlanning, PlanningAyam, OutboundAyam],
        synchronize: true, // HATI-HATI: bisa drop tabel jika terjadi error sync. Gunakan migration untuk production.
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, Shift, Barang, Gudang, Suplayer, Customer, Transaksi, Stock, StockLog, PlanningAyam, OutboundAyam, InboundPlanning]),
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
    ],
  controllers: [AppController, ShiftsController],
  providers: [AppService, SeedService],
})
export class AppModule { }
