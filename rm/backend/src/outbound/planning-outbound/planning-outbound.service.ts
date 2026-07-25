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
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async findWithFilter(filter: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.dateFrom && filter.dateTo) {
      where.created_at = Between(
        new Date(filter.dateFrom),
        new Date(filter.dateTo + 'T23:59:59'),
      );
    }
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  async findOne(id: number) {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException('Planning outbound tidak ditemukan');
    return item;
  }

  async create(dto: CreatePlanningOutboundDto) {
    const customer = dto.customer_id
      ? await this.customerRepo.findOneBy({ id: dto.customer_id })
      : null;
    const shift = dto.shift_id
      ? await this.shiftRepo.findOneBy({ id: dto.shift_id })
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
    const item = await this.findOne(id);
    if (dto.customer_id !== undefined) {
      item.customer = (
        dto.customer_id
          ? await this.customerRepo.findOneBy({ id: dto.customer_id })
          : null
      ) as any;
    }
    if (dto.shift_id !== undefined) {
      item.shift = (
        dto.shift_id
          ? await this.shiftRepo.findOneBy({ id: dto.shift_id })
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
    const item = await this.findOne(id);
    if (item.status === 'DONE') {
      throw new BadRequestException('Cannot remove a published planning');
    }
    return this.repo.remove(item);
  }

  async processOutbound(id: number, dto: ProcessPlanningOutboundDto) {
    const planning = await this.findOne(id);

    if (planning.status !== 'WAIT') {
      throw new BadRequestException(
        `Cannot process planning with status '${planning.status}'. Only 'WAIT' plans can be processed.`,
      );
    }

    planning.process_data = dto;
    planning.status = 'PROGRESS'; // draft mode
    return this.repo.save(planning);
  }

  async publishOutbound(id: number, dto: PublishPlanningOutboundDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const planning = await manager.findOne(PlanningOutbound, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });

        if (!planning)
          throw new NotFoundException(`Planning with ID ${id} not found`);

        const fullPlanning = await manager.findOne(PlanningOutbound, {
          where: { id },
          relations: ['customer', 'shift'],
        });
        if (fullPlanning) {
          planning.customer = fullPlanning.customer;
          planning.shift = fullPlanning.shift;
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
          const barang = await manager.findOneBy(Barang, { id: item.barangId });
          if (!barang)
            throw new BadRequestException(
              `Barang ID ${item.barangId} not found`,
            );

          if (
            item.tujuan === 'RETURN_TO_WH' ||
            item.tujuan === 'MISSING' ||
            item.tujuan === 'WASTE' ||
            item.tujuan === 'REJECT'
          ) {
            // Special categories deduct stock physically (unless we handle reserved, but since we didn't reserve physical stock yet, we just deduct what is lost/wasted)
            if (item.gudangId) {
              const gudang = await manager.findOneBy(Gudang, {
                id: item.gudangId,
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
            const gudang = item.gudangId
              ? await manager.findOneBy(Gudang, { id: item.gudangId })
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
