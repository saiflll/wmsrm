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
    private relocation_repo: Repository<Relocation>,
    @InjectRepository(Stock) private stock_repo: Repository<Stock>,
    @InjectRepository(StockLog) private log_repo: Repository<StockLog>,
    @InjectRepository(Gudang) private gudang_repo: Repository<Gudang>,
    private data_source: DataSource,
  ) {}

  async find_all(): Promise<Relocation[]> {
    return this.relocation_repo.find({
      where: { status: RelocationStatus.DRAFT },
      relations: ['source_stock', 'source_stock.barang', 'target_gudang'],
      order: { created_at: 'DESC' },
    });
  }

  async create_relocation(dto: CreateRelocationDto): Promise<Relocation> {
    const stock = await this.stock_repo.findOne({
      where: { id: dto.stock_id },
      relations: ['barang', 'gudang'],
    });
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${dto.stock_id} not found`);
    }

    const target_gudang_id = dto.target_gudang_id || (dto as any).gudang_tujuan_id;
    const gudang = await this.gudang_repo.findOne({
      where: { id: target_gudang_id },
    });
    if (!gudang) {
      throw new NotFoundException(
        `Gudang with ID ${target_gudang_id} not found`,
      );
    }

    if (stock.qty < dto.qty) {
      throw new BadRequestException(
        `Qty melebihi stok tersedia (${stock.qty})`,
      );
    }

    const relocation = this.relocation_repo.create({
      source_stock: stock,
      target_gudang: gudang,
      qty: dto.qty,
      status: RelocationStatus.DRAFT,
    });

    return this.relocation_repo.save(relocation);
  }

  async delete_relocation(id: number): Promise<{ success: boolean }> {
    const relocation = await this.relocation_repo.findOne({ where: { id: Number(id) } });
    if (!relocation) {
      throw new NotFoundException(`Relocation draft with ID ${id} not found`);
    }
    if (relocation.status === RelocationStatus.EXECUTED) {
      throw new BadRequestException('Relocation yang sudah dieksekusi tidak dapat dihapus');
    }
    await this.relocation_repo.remove(relocation);
    return { success: true };
  }

  async execute_relocation(id: number): Promise<Relocation> {
    return this.data_source.transaction(async (manager) => {
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

      const batch_condition = stock.batch_no ? stock.batch_no : IsNull();
      let dest_stock = await manager.findOne(Stock, {
        where: {
          barang: { id: stock.barang.id },
          gudang: { id: relocation.target_gudang.id },
          batch_no: batch_condition,
        },
      });

      if (dest_stock) {
        dest_stock.qty += relocation.qty;
        await manager.save(Stock, dest_stock);
      } else {
        dest_stock = manager.create(Stock, {
          barang: stock.barang,
          gudang: relocation.target_gudang,
          batch_no: stock.batch_no || '',
          lot_no: stock.lot_no || '',
          qty: relocation.qty,
          satuan: stock.satuan,
          expiry_date: stock.expiry_date,
        });
        await manager.save(Stock, dest_stock);
      }

      const source_gudang_name = stock.gudang?.name || 'Gudang Asal';
      const target_gudang_name = relocation.target_gudang?.name || 'Gudang Tujuan';

      const log = manager.create(StockLog, {
        type: LogType.RELOCATION,
        barang: stock.barang,
        gudang: stock.gudang,
        gudang_tujuan: relocation.target_gudang,
        qty: relocation.qty,
        satuan: stock.satuan,
        batch_no: stock.batch_no,
        expiry_date: stock.expiry_date,
        note: `Relokasi dari ${source_gudang_name} ke ${target_gudang_name}`,
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

      const total_stok_result = await manager
        .createQueryBuilder(Stock, 'st')
        .select('COALESCE(SUM(st.qty), 0)', 'total')
        .where('st.barangId = :barangId', { barang_id: stock.barang.id })
        .getRawOne();

      await manager.update(Barang, stock.barang.id, {
        stok: Number(total_stok_result?.total || 0),
      });

      return relocation;
    });
  }
}
