import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Relocation } from './relocation.entity';
import { Stock } from './stock.entity';
import { StockLog } from './stock-log.entity';
import { Gudang } from '../gudang/gudang.entity';
import { RelocationService } from './relocation.service';
import { RelocationController } from './relocation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Relocation, Stock, StockLog, Gudang])],
  controllers: [RelocationController],
  providers: [RelocationService],
  exports: [RelocationService],
})
export class RelocationModule {}
