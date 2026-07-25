import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gudang } from './gudang.entity';
import { GudangService } from './gudang.service';
import { GudangController } from './gudang.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Gudang])],
  providers: [GudangService],
  controllers: [GudangController],
  exports: [GudangService],
})
export class GudangModule {}
