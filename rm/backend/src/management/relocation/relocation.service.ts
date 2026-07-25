import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Relocation, RelocationStatus } from './relocation.entity';
import { Stock } from '../inventory/stock.entity';
import { StockLog, LogType } from '../inventory/stock-log.entity';
import { Gudang } from '../../master/gudang/gudang.entity';
import { Barang } from '../../master/barang/barang.entity';
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

  async findAll(): Promise<Relocation[]> {
    return this.relocationRepo.find({
      where: { status: RelocationStatus.DRAFT },
      relations: ['source_stock', 'source_stock.barang', 'target_gudang'],
      order: { created_at: 'DESC' },
    });
  }

  async createRelocation(dto: CreateRelocationDto): Promise<Relocation> {
    const stock = await this.stockRepo.findOne({
      where: { id: dto.stock_id },
      relations: ['barang', 'gudang'],
    });
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${dto.stock_id} not found`);
    }

    const targetGudangId = dto.target_gudang_id || (dto as any).gudang_tujuan_id;
    const gudang = await this.gudangRepo.findOne({
      where: { id: targetGudangId },
    });
    if (!gudang) {
      throw new NotFoundException(
        `Gudang with ID ${targetGudangId} not found`,
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

  async deleteRelocation(id: number): Promise<{ success: boolean }> {
    const relocation = await this.relocationRepo.findOne({ where: { id: Number(id) } });
    if (!relocation) {
      throw new NotFoundException(`Relocation draft with ID ${id} not found`);
    }
    if (relocation.status === RelocationStatus.EXECUTED) {
      throw new BadRequestException('Relocation yang sudah dieksekusi tidak dapat dihapus');
    }
    await this.relocationRepo.remove(relocation);
    return { success: true };
  }

  async executeRelocation(id: number): Promise<Relocation> {
    return this.dataSource.transaction(async (manager) => {
      const relocation = await manager.findOne(Relocation, {
        where: { id: Number(id) },
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

      if (!relocation.source_stock) {
        throw new BadRequestException('Stok asal sudah tidak tersedia / terhapus');
      }

      const stock = await manager.findOne(Stock, {
        where: { id: relocation.source_stock.id },
        relations: ['barang', 'gudang'],
      });

      if (!stock) {
        throw new BadRequestException('Stok asal sudah tidak tersedia di gudang');
      }

      if (!stock.barang) {
        throw new BadRequestException('Data barang pada stok asal tidak ditemukan');
      }

      if (!relocation.target_gudang) {
        throw new BadRequestException('Rak/gudang tujuan relokasi tidak ditemukan');
      }

      if (stock.qty < relocation.qty) {
        throw new BadRequestException(
          `Stok asal tidak cukup. Tersedia: ${stock.qty}, Diminta: ${relocation.qty}`,
        );
      }

      stock.qty -= relocation.qty;

      const batchCondition = stock.batch_no ? stock.batch_no : IsNull();
      let destStock = await manager.findOne(Stock, {
        where: {
          barang: { id: stock.barang.id },
          gudang: { id: relocation.target_gudang.id },
          batch_no: batchCondition,
        },
      });

      if (destStock) {
        destStock.qty += relocation.qty;
        await manager.save(Stock, destStock);
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
        await manager.save(Stock, destStock);
      }

      const sourceGudangName = stock.gudang?.name || 'Gudang Asal';
      const targetGudangName = relocation.target_gudang?.name || 'Gudang Tujuan';

      const log = manager.create(StockLog, {
        type: LogType.RELOCATION,
        barang: stock.barang,
        gudang: stock.gudang,
        gudang_tujuan: relocation.target_gudang,
        qty: relocation.qty,
        satuan: stock.satuan,
        batch_no: stock.batch_no,
        expiry_date: stock.expiry_date,
        note: `Relokasi dari ${sourceGudangName} ke ${targetGudangName}`,
      } as any);
      await manager.save(StockLog, log);

      if (stock.qty <= 0) {
        await manager.remove(Stock, stock);
      } else {
        await manager.save(Stock, stock);
      }

      relocation.status = RelocationStatus.EXECUTED;
      relocation.executed_at = new Date();
      await manager.save(Relocation, relocation);

      const totalStokResult = await manager
        .createQueryBuilder(Stock, 'st')
        .select('COALESCE(SUM(st.qty), 0)', 'total')
        .where('st.barangId = :barangId', { barangId: stock.barang.id })
        .getRawOne();

      await manager.update(Barang, stock.barang.id, {
        stok: Number(totalStokResult?.total || 0),
      });

      return relocation;
    });
  }
}
