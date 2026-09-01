import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, EntityManager } from 'typeorm';
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

  private async adjust_reservations(
    manager: EntityManager,
    items: PlanningOutbound['items'] | null | undefined,
    direction: 1 | -1,
  ) {
    for (const item of items || []) {
      // Samakan dengan inbound: findOne tanpa lock/pessimistic_write, hindari FOR UPDATE di outer join
      let stock = await manager.findOne(Stock, {
        where: {
          barang: { id: item.barang_id },
          gudang: { id: item.gudang_id },
          ...(item.batch_no ? { batch_no: item.batch_no } : {}),
        },
      });
      if (!stock && item.batch_no) {
        stock = await manager.findOne(Stock, {
          where: { barang: { id: item.barang_id }, gudang: { id: item.gudang_id } },
        });
      }
      if (!stock) {
        throw new BadRequestException(
          `Stock barang ${item.barang_id} di gudang ${item.gudang_id} tidak ditemukan`,
        );
      }
      const qty = Number(item.qty || 0);
      if (qty <= 0) throw new BadRequestException('Qty planning harus lebih dari 0');

      if (direction === 1) {
        const available = Number(stock.qty || 0) - Number(stock.reserved_qty || 0);
        if (available < qty) {
          throw new BadRequestException(
            `Stok tersedia tidak mencukupi. Tersedia ${available}, diminta ${qty}`,
          );
        }
        stock.reserved_qty = Number(stock.reserved_qty || 0) + qty;
      } else {
        stock.reserved_qty = Math.max(0, Number(stock.reserved_qty || 0) - qty);
      }
      await manager.save(Stock, stock);
    }
  }

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

  async create(dto: CreatePlanningOutboundDto, username?: string) {
    const customer = dto.customer_id
      ? await this.customer_repo.findOneBy({ id: dto.customer_id })
      : null;
    const shift = dto.shift_id
      ? await this.shift_repo.findOneBy({ id: dto.shift_id })
      : null;

    return this.data_source.transaction(async (manager) => {
      await this.adjust_reservations(manager, dto.items, 1);
      const item = manager.create(PlanningOutbound, {
        ...dto,
        tanggal_planning: new Date(dto.tanggal_planning),
        customer,
        shift,
        status: dto.status ?? 'DRAFT',
        created_by_username: username,
      } as any);
      return manager.save(PlanningOutbound, item);
    });
  }

  async update(id: number, dto: UpdatePlanningOutboundDto) {
    const item = await this.find_one(id);
    if (item.status !== 'WAIT' && item.status !== 'DRAFT') {
      throw new BadRequestException('Hanya planning berstatus WAIT atau DRAFT yang bisa diubah');
    }
    if (dto.status !== undefined && dto.status !== 'WAIT') {
      throw new BadRequestException('Status planning tidak dapat diubah lewat form edit');
    }
    if (dto.items !== undefined) {
      const next_customer =
        dto.customer_id !== undefined
          ? dto.customer_id
            ? await this.customer_repo.findOneBy({ id: dto.customer_id })
            : null
          : item.customer;
      const next_shift =
        dto.shift_id !== undefined
          ? dto.shift_id
            ? await this.shift_repo.findOneBy({ id: dto.shift_id })
            : null
          : item.shift;
      return this.data_source.transaction(async (manager) => {
        const locked = await manager.findOne(PlanningOutbound, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });
        if (!locked || (locked.status !== 'WAIT' && locked.status !== 'DRAFT')) {
          throw new BadRequestException('Planning tidak ditemukan atau bukan WAIT/DRAFT');
        }
        await this.adjust_reservations(manager, locked.items, -1);
        await this.adjust_reservations(manager, dto.items, 1);
        Object.assign(locked, {
          ...dto,
          tanggal_planning: dto.tanggal_planning
            ? new Date(dto.tanggal_planning)
            : locked.tanggal_planning,
          customer: next_customer,
          shift: next_shift,
          status: locked.status,
        });
        return manager.save(PlanningOutbound, locked);
      });
    }
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

  async promote(id: number, itemIndices?: number[]) {
    const plan = await this.find_one(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException(
        `Planning dengan status '${plan.status}' tidak bisa dipromote. Hanya DRAFT yang bisa dipublish.`,
      );
    }

    const items: any[] = Array.isArray(plan.items) ? plan.items : [];
    const haveSelection = Array.isArray(itemIndices) && itemIndices.length > 0;

    if (!haveSelection) {
      plan.status = 'WAIT';
      plan.published_at = new Date();
      return this.repo.save(plan);
    }

    const idxSet = new Set(
      itemIndices!.filter(
        (i) => Number.isInteger(i) && i >= 0 && i < items.length,
      ),
    );
    if (idxSet.size === 0) {
      throw new BadRequestException('Index item tidak valid');
    }

    const selected = items.filter((_, i) => idxSet.has(i));
    const remaining = items.filter((_, i) => !idxSet.has(i));

    if (remaining.length === 0) {
      plan.status = 'WAIT';
      plan.published_at = new Date();
      return this.repo.save(plan);
    }

    const newPlan = this.repo.create({
      no_ref: plan.no_ref,
      customer: plan.customer,
      shift: plan.shift,
      tanggal_planning: plan.tanggal_planning,
      tujuan: plan.tujuan,
      keterangan: plan.keterangan,
      items: selected,
      status: 'WAIT',
      published_at: new Date(),
      created_by_username: plan.created_by_username,
    } as any);

    plan.items = remaining;

    const [savedNew] = await Promise.all([
      this.repo.save(newPlan),
      this.repo.save(plan),
    ]);

    return { plan, created: savedNew };
  }

  async remove(id: number) {
    const item = await this.find_one(id);
    if (item.status === 'DONE') {
      throw new BadRequestException('Cannot remove a published planning');
    }
    return this.data_source.transaction(async (manager) => {
      const locked = await manager.findOne(PlanningOutbound, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!locked) throw new NotFoundException('Planning outbound tidak ditemukan');
      await this.adjust_reservations(manager, locked.items, -1);
      return manager.remove(PlanningOutbound, locked);
    });
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

  async publish_outbound(id: number, dto: PublishPlanningOutboundDto, user_id?: number, username?: string) {
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
        const executed_at = new Date();

        // The plan owns this reservation. Release it atomically before consuming
        // physical stock so available stock is never double-counted.
        await this.adjust_reservations(manager, planning.items, -1);

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
                  user: user_id ? ({ id: user_id } as any) : undefined,
                  source_planning_id: planning.id,
                  planned_by_username: planning.created_by_username || 'system',
                  planned_at: planning.created_at,
                  executed_by_username: username || 'system',
                  executed_at,
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
                user: user_id ? ({ id: user_id } as any) : undefined,
                source_planning_id: planning.id,
                planned_by_username: planning.created_by_username || 'system',
                planned_at: planning.created_at,
                executed_by_username: username || 'system',
                executed_at,
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
        planning.published_at = executed_at;
        planning.executed_by_username = username || 'system';
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
