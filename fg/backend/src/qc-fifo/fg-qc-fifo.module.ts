import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgQcFifoService } from './fg-qc-fifo.service.js';
import { FgQcFifoController } from './fg-qc-fifo.controller.js';
import { FgStockModule } from '../stock/fg-stock.module.js';

@Module({
  imports: [FgStockModule],
  controllers: [FgQcFifoController],
  providers: [FgQcFifoService],
})
export class FgQcFifoModule {}
