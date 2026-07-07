import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgOtdr } from './fg-otdr.entity.js';
import { FgOtdrService } from './fg-otdr.service.js';
import { FgOtdrController } from './fg-otdr.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgOtdr])],
  controllers: [FgOtdrController],
  providers: [FgOtdrService],
  exports: [FgOtdrService],
})
export class FgOtdrModule {}
