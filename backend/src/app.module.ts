import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Entities
import { User } from './users/user.entity';
import { Shift } from './shifts/shift.entity';
import { Suplayer } from './suplayers/suplayer.entity';
import { Barang } from './barang/barang.entity';
import { Gudang } from './gudang/gudang.entity';
import { Transaksi } from './transaksi/transaksi.entity';
import { Stock } from './inventory/stock.entity';
import { StockLog } from './inventory/stock-log.entity';
import { Customer } from './customers/customer.entity';

// Modules
import { AuthModule } from './auth/auth.module';
import { BarangModule } from './barang/barang.module';
import { TransaksiModule } from './transaksi/transaksi.module';
import { GudangModule } from './gudang/gudang.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { HardwareModule } from './hardware/hardware.module';

import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [User, Shift, Suplayer, Barang, Gudang, Transaksi, Stock, StockLog, Customer],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, Shift, Suplayer, Barang, Gudang, Transaksi, Stock, StockLog, Customer]),
    AuthModule,
    BarangModule,
    TransaksiModule,
    GudangModule,
    InventoryModule,
    CustomersModule,
    HardwareModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule { }
