import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';

// Raw payload from ESP32 / PLC sensors
interface HwPayload {
  device_id: string;
  sku?: string;
  barcode?: string;
  rack?: string;
  weight?: number;
  temperature?: number;
  humidity?: number;
  timestamp?: string;
}

@Controller('hardware')
export class HardwareController {
  constructor(
    @InjectRepository(Barang) private barangRepo: Repository<Barang>,
    @InjectRepository(Gudang) private gudangRepo: Repository<Gudang>,
  ) {}

  @Post('sniff')
  @HttpCode(200)
  async sniff(@Body() payload: HwPayload) {
    let barang: Barang | null = null;
    let gudang: Gudang | null = null;

    // Map SKU/barcode to product
    if (payload.sku || payload.barcode) {
      barang = await this.barangRepo.findOneBy({
        sku: payload.sku || payload.barcode,
      });
    }

    // Map rack to location
    if (payload.rack) {
      gudang = await this.gudangRepo.findOneBy({ name: payload.rack });
    }

    return {
      device_id: payload.device_id,
      matched_product: barang
        ? { id: barang.id, nama: barang.nama, sku: barang.sku }
        : null,
      matched_location: gudang
        ? { id: gudang.id, name: gudang.name, zone: (gudang as any).zone }
        : null,
      raw: payload,
      timestamp: new Date().toISOString(),
    };
  }
}
