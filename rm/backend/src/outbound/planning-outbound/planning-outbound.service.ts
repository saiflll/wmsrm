import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { PlanningOutbound } from './planning-outbound.entity';
import {
  CreatePlanningOutboundDto,
  UpdatePlanningOutboundDto,
  ProcessPlanningOutboundDto,
  PublishPlanningOutboundDto,
} from './planning-outbound.dto';
import { Customer } from '../../master/customers/customer.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { Stock } from '../../management/inventory/stock.entity';
import { StockLog, LogType } from '../../management/inventory/stock-log.entity';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';

@Injectable()
export class PlanningOutboundService {
  constructor(
    @InjectRepository(PlanningOutbound)
    private repo: Repository<PlanningOutbound>,
    @InjectRepository(Customer) private customer_repo: Repository<Customer>,
    @InjectRepository(Shift) private shift_repo: Repository<Shift>,
    private data_source: DataSource,
  ) {}

  async find_all() {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async find_with_filter(filter: {
    status?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.date_from && filter.date_to) {
      where.created_at = Between(
        new Date(filter.date_from),
        new Date(filter.date_to + 'T23:59:59'),
      );
    }
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  async find_one(id: number) {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException('Planning outbound tidak ditemukan');
    return item;
  }

  async create(dto: CreatePlanningOutboundDto) {
    const customer = dto.customer_id
      ? await this.customer_repo.findOneBy({ id: dto.customer_id })
      : null;
    const shift = dto.shift_id
      ? await this.shift_repo.findOneBy({ id: dto.shift_id })
      : null;

    const item = this.repo.create({
      ...dto,
      tanggal_planning: new Date(dto.tanggal_planning),
      customer,
      shift,
    } as any);
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdatePlanningOutboundDto) {
    const item = await this.find_one(id);
    if (dto.customer_id !== undefined) {
      item.customer = (
        dto.customer_id
          ? await this.customer_repo.findOneBy({ id: dto.customer_id })
          : null
      ) as any;
    }
    if (dto.shift_id !== undefined) {
      item.shift = (
        dto.shift_id
          ? await this.shift_repo.findOneBy({ id: dto.shift_id })
          : null
      ) as any;
    }
    if (dto.tanggal_planning)
      item.tanggal_planning = new Date(dto.tanggal_planning);
    if (dto.no_ref !== undefined) item.no_ref = dto.no_ref;
    if (dto.tujuan !== undefined) item.tujuan = dto.tujuan;
    if (dto.keterangan !== undefined) item.keterangan = dto.keterangan;
    if (dto.status !== undefined) item.status = dto.status;
    if (dto.items !== undefined) item.items = dto.items;

    return this.repo.save(item);
  }

  async remove(id: number) {
    const item = await this.find_one(id);
    if (item.status === 'DONE') {
      throw new BadRequestException('Cannot remove a published planning');
    }
    return this.repo.remove(item);
  }

  async process_outbound(id: number, dto: ProcessPlanningOutboundDto) {
    const planning = await this.find_one(id);

    if (planning.status !== 'WAIT') {
      throw new BadRequestException(
        `Cannot process planning with status '${planning.status}'. Only 'WAIT' plans can be processed.`,
      );
    }

    planning.process_data = dto;
    planning.status = 'PROGRESS'; // draft mode
    return this.repo.save(planning);
  }

  async publish_outbound(id: number, dto: PublishPlanningOutboundDto) {
    try {
      return await this.data_source.transaction(async (manager) => {
        const planning = await manager.findOne(PlanningOutbound, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });

        if (!planning)
          throw new NotFoundException(`Planning with ID ${id} not found`);

        const full_planning = await manager.findOne(PlanningOutbound, {
          where: { id },
          relations: ['customer', 'shift'],
        });
        if (full_planning) {
          planning.customer = full_planning.customer;
          planning.shift = full_planning.shift;
        }

        if (!planning.process_data || !planning.process_data.items) {
          throw new BadRequestException(
            'Planning belum diproses. Lakukan process terlebih dahulu.',
          );
        }
        if (planning.status !== 'PROGRESS') {
          throw new BadRequestException(
            `Planning status harus PROGRESS untuk publish.`,
          );
        }

        for (const item of planning.process_data.items) {
          const barang = await manager.findOneBy(Barang, { id: item.barang_id });
          if (!barang)
            throw new BadRequestException(
              `Barang ID ${item.barang_id} not found`,
            );

          if (
            item.tujuan === 'RETURN_TO_WH' ||
            item.tujuan === 'MISSING' ||
            item.tujuan === 'WASTE' ||
            item.tujuan === 'REJECT'
          ) {
            // Special categories deduct stock physically (unless we handle reserved, but since we didn't reserve physical stock yet, we just deduct what is lost/wasted)
            if (item.gudang_id) {
              const gudang = await manager.findOneBy(Gudang, {
                id: item.gudang_id,
              });
              if (gudang) {
                // Return to WH just adds back or ignores deduction. Since we didn't deduct yet, for RETURN_TO_WH we do NOT deduct physically, just log it.
                if (item.tujuan !== 'RETURN_TO_WH') {
                  const stock = await manager.findOne(Stock, {
                    where: {
                      barang: { id: barang.id },
                      gudang: { id: gudang.id },
                      ...(item.batch_no ? { batch_no: item.batch_no } : {}),
                    },
                  });
                  if (stock) {
                    stock.qty -= item.qty;
                    if (stock.qty < 0) stock.qty = 0;
                    await manager.save(Stock, stock);
                  }
                }

                const log = manager.create(StockLog, {
                  type: LogType.OUTBOUND,
                  no_ref: planning.no_ref,
                  barang,
                  gudang,
                  qty: item.qty,
                  satuan: barang.satuan,
                  batch_no: item.batch_no,
                  tujuan: item.tujuan,
                  keterangan:
                    dto.keterangan || `Outbound Split: ${item.tujuan}`,
                  shift: planning.shift,
                } as any);
                await manager.save(StockLog, log);
              }
            }
          } else {
            // Normal category: deduct from physical stock
            const gudang = item.gudang_id
              ? await manager.findOneBy(Gudang, { id: item.gudang_id })
              : null;
            if (gudang) {
              const stock = await manager.findOne(Stock, {
                where: {
                  barang: { id: barang.id },
                  gudang: { id: gudang.id },
                  ...(item.batch_no ? { batch_no: item.batch_no } : {}),
                },
              });
              if (stock) {
                stock.qty -= item.qty;
                if (stock.qty < 0) stock.qty = 0;
                await manager.save(Stock, stock);
              }

              const log = manager.create(StockLog, {
                type: LogType.OUTBOUND,
                no_ref: planning.no_ref,
                barang,
                gudang,
                qty: item.qty,
                satuan: stock?.satuan || barang.satuan,
                batch_no: item.batch_no,
                expiry_date: stock?.expiry_date,
                tujuan: item.tujuan,
                keterangan: dto.keterangan || planning.keterangan,
                shift: planning.shift,
              } as any);
              await manager.save(StockLog, log);
            }
          }
        }

        for (const barang_id of new Set(
          planning.process_data.items.map((item) => item.barang_id),
        )) {
          const result = await manager
            .getRepository(Stock)
            .createQueryBuilder('stock')
            .select('COALESCE(SUM(stock.qty), 0)', 'total')
            .where('stock.barangId = :barangId', { barangId: barang_id })
            .getRawOne();
          await manager.update(Barang, barang_id, {
            stok: Number(result?.total || 0),
          });
        }

        planning.status = 'DONE';
        planning.published_at = new Date();
        return manager.save(PlanningOutbound, planning);
      });
    } catch (error) {
      console.error(
        `[PublishOutbound] Error publishing planning ${id}:`,
        error,
      );
      throw error;
    }
  }
}
