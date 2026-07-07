import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgLogImportStock } from './fg-log-import-stock.entity.js';
import { FgImportStockService } from './fg-import-stock.service.js';
import { FgImportStockController } from './fg-import-stock.controller.js';
import { FgStockModule } from '../stock/fg-stock.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgLogImportStock]), FgStockModule],
  controllers: [FgImportStockController],
  providers: [FgImportStockService],
})
export class FgImportStockModule {}
