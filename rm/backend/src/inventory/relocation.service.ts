import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Relocation, RelocationStatus } from './relocation.entity';
import { Stock } from './stock.entity';
import { StockLog, LogType } from './stock-log.entity';
import { Gudang } from '../gudang/gudang.entity';
import { CreateRelocationDto } from './relocation.dto';

@Injectable()
export class RelocationService {
  constructor(
    @InjectRepository(Relocation)
    private relocationRepo: Repository<Relocation>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(StockLog) private logRepo: Repository<StockLog>,
    @InjectRepository(Gudang) private gudangRepo: Repository<Gudang>,
    private dataSource: DataSource,
  ) {}

  async createRelocation(dto: CreateRelocationDto): Promise<Relocation> {
    const stock = await this.stockRepo.findOne({
      where: { id: dto.stock_id },
      relations: ['barang', 'gudang'],
    });
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${dto.stock_id} not found`);
    }

    const gudang = await this.gudangRepo.findOne({
      where: { id: dto.target_gudang_id },
    });
    if (!gudang) {
      throw new NotFoundException(
        `Gudang with ID ${dto.target_gudang_id} not found`,
      );
    }

    if (stock.qty < dto.qty) {
      throw new BadRequestException(
        `Qty melebihi stok tersedia (${stock.qty})`,
      );
    }

    const relocation = this.relocationRepo.create({
      source_stock: stock,
      target_gudang: gudang,
      qty: dto.qty,
      status: RelocationStatus.DRAFT,
    });

    return this.relocationRepo.save(relocation);
  }

  async executeRelocation(id: number): Promise<Relocation> {
    return this.dataSource.transaction(async (manager) => {
      const relocation = await manager.findOne(Relocation, {
        where: { id },
        relations: [
          'source_stock',
          'source_stock.barang',
          'source_stock.gudang',
          'target_gudang',
        ],
      });

      if (!relocation) {
        throw new NotFoundException(`Relocation with ID ${id} not found`);
      }

      if (relocation.status === RelocationStatus.EXECUTED) {
        throw new BadRequestException('Relocation sudah pernah dieksekusi');
      }

      // Lock source stock row
      const stock = await manager.findOne(Stock, {
        where: { id: relocation.source_stock.id },
        relations: ['barang', 'gudang'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!stock) {
        throw new NotFoundException('Source stock tidak ditemukan');
      }

      // Validate qty still available
      if (stock.qty < relocation.qty) {
        throw new BadRequestException(
          `Stok tidak cukup untuk relokasi. Tersedia: ${stock.qty}, Diminta: ${relocation.qty}`,
        );
      }

      // Deduct from source
      stock.qty -= relocation.qty;

      // Add to destination or create new stock entry
      let destStock = await manager.findOne(Stock, {
        where: {
          barang: { id: stock.barang.id },
          gudang: { id: relocation.target_gudang.id },
          batch_no: stock.batch_no || '',
        },
      });

      if (destStock) {
        destStock.qty += relocation.qty;
      } else {
        destStock = manager.create(Stock, {
          barang: stock.barang,
          gudang: relocation.target_gudang,
          batch_no: stock.batch_no || '',
          lot_no: stock.lot_no || '',
          qty: relocation.qty,
          satuan: stock.satuan,
          expiry_date: stock.expiry_date,
        });
      }
      await manager.save(Stock, destStock);

      // Log movement
      const log = manager.create(StockLog, {
        type: LogType.RELOCATION,
        barang: stock.barang,
        gudang: stock.gudang,
        gudang_tujuan: relocation.target_gudang,
        qty: relocation.qty,
        satuan: stock.satuan,
        batch_no: stock.batch_no,
        expiry_date: stock.expiry_date,
        note: `Relokasi dari ${stock.gudang.name} ke ${relocation.target_gudang.name}`,
      } as any);
      await manager.save(StockLog, log);

      // Delete source if qty <= 0
      if (stock.qty <= 0) {
        await manager.remove(Stock, stock);
      } else {
        await manager.save(Stock, stock);
      }

      // Update relocation status
      relocation.status = RelocationStatus.EXECUTED;
      relocation.executed_at = new Date();
      await manager.save(Relocation, relocation);

      // Sync barang stok
      await manager.update('barang', stock.barang.id, {
        stok: () =>
          `COALESCE((SELECT SUM(qty) FROM stock WHERE barang_id = ${stock.barang.id}), 0)`,
      });

      return relocation;
    });
  }
}
