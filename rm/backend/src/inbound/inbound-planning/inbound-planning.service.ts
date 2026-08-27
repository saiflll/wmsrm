import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { InboundPlanning } from './inbound-planning.entity';
import {
  CreateInboundPlanningDto,
  UpdateInboundPlanningDto,
  ProcessInboundDto,
} from './inbound-planning.dto';
import { Stock } from '../../management/inventory/stock.entity';
import { StockLog, LogType } from '../../management/inventory/stock-log.entity';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';
import { Shift } from '../../master/shifts/shift.entity';

@Injectable()
export class InboundPlanningService {
  constructor(
    @InjectRepository(InboundPlanning)
    private readonly repo: Repository<InboundPlanning>,
    @InjectRepository(Stock)
    private readonly stock_repo: Repository<Stock>,
    @InjectRepository(StockLog)
    private readonly log_repo: Repository<StockLog>,
    @InjectRepository(Barang)
    private readonly barang_repo: Repository<Barang>,
    @InjectRepository(Gudang)
    private readonly gudang_repo: Repository<Gudang>,
    @InjectRepository(Shift)
    private readonly shift_repo: Repository<Shift>,
    private data_source: DataSource,
  ) {}

  async find_all(page: number = 1, limit: number = 50, status?: string) {
    const now = new Date();
    const where: any = { deleted_at: IsNull() };
    if (status) where.status = status;
    const [plans, total] = await this.repo.findAndCount({
      where,
      order: { estimasi_datang: 'ASC', created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = plans.map((p) => ({
      ...p,
      isLate:
        p.status === 'WAIT' &&
        p.estimasi_datang &&
        new Date(p.estimasi_datang) < now,
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async find_one(id: number) {
    const item = await this.repo.findOneBy({ id });
    if (!item)
      throw new NotFoundException(`Inbound planning with ID ${id} not found`);
    return item;
  }

  create(dto: CreateInboundPlanningDto, username?: string) {
    const item = this.repo.create({
      ...dto,
      estimasi_datang: dto.estimasi_datang
        ? new Date(dto.estimasi_datang)
        : undefined,
      status: dto.status ?? 'DRAFT',
      created_by_username: username,
    });
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

    // No specific items selected => promote the whole draft to WAIT.
    if (!haveSelection) {
      plan.status = 'WAIT';
      plan.published_at = new Date();
      return this.repo.save(plan);
    }

    const idxSet = new Set(itemIndices!.filter((i) => Number.isInteger(i) && i >= 0 && i < items.length));
    if (idxSet.size === 0) {
      throw new BadRequestException('Index item tidak valid');
    }

    const selected = items.filter((_, i) => idxSet.has(i));
    const remaining = items.filter((_, i) => !idxSet.has(i));

    // All items selected => just promote the existing draft.
    if (remaining.length === 0) {
      plan.status = 'WAIT';
      plan.published_at = new Date();
      return this.repo.save(plan);
    }

    // Split: selected items become a new WAIT plan, the rest stay in the DRAFT.
    const sumQty = (list: any[]) =>
      list.reduce((acc, it) => acc + Number(it.qty || 0), 0);

    const newPlan = this.repo.create({
      no_po: plan.no_po,
      supplier: plan.supplier,
      estimasi_datang: plan.estimasi_datang,
      note: plan.note,
      zone: plan.zone,
      alokasi: plan.alokasi,
      rack_allocations: plan.rack_allocations,
      items: selected,
      qty: sumQty(selected),
      status: 'WAIT',
      published_at: new Date(),
      created_by_username: plan.created_by_username,
    } as any);

    plan.items = remaining;
    plan.qty = sumQty(remaining);

    const [savedNew] = await Promise.all([
      this.repo.save(newPlan),
      this.repo.save(plan),
    ]);

    return { plan, created: savedNew };
  }

  async update(id: number, dto: UpdateInboundPlanningDto) {
    const item = await this.find_one(id);
    const data: any = { ...dto };
    if (dto.estimasi_datang) {
      data.estimasi_datang = new Date(dto.estimasi_datang);
    }
    await this.repo.update(id, data);
    return this.find_one(id);
  }

  async process_inbound(
    id: number,
    dto: ProcessInboundDto,
    user_role: string,
    user_id?: number,
    username?: string,
  ) {
    return this.data_source.transaction(async (manager) => {
      // 1. Lock planning row (pessimistic_write)
      const plan = await manager.findOne(InboundPlanning, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!plan)
        throw new NotFoundException(`Inbound planning with ID ${id} not found`);

      // 2. Validate status === 'WAIT'
      if (plan.status !== 'WAIT') {
        throw new BadRequestException(
          `Cannot process inbound planning with status '${plan.status}'. Only 'WAIT' plans can be processed.`,
        );
      }

      // Load shift if provided
      let shift: Shift | null = null;
      if (dto.shift_id) {
        shift = await manager.findOneBy(Shift, { id: dto.shift_id });
      }

      let total_received = 0;
      const executed_at = new Date();

      for (const item of dto.items) {
        // 3. Validate barang & gudang exist
        const barang = await manager.findOneBy(Barang, { id: item.barang_id });
        if (!barang) {
          throw new BadRequestException(`Barang ID ${item.barang_id} not found`);
        }

        const gudang = await manager.findOneBy(Gudang, { id: item.gudang_id });
        if (!gudang) {
          throw new BadRequestException(`Gudang ID ${item.gudang_id} not found`);
        }

        total_received += item.qty;

        // 4. Upsert stock (Barang+Gudang+batch_no)
        const batch_key = item.batch_no || '';
        let stock = await manager.findOne(Stock, {
          where: {
            barang: { id: barang.id },
            gudang: { id: gudang.id },
            batch_no: batch_key,
          },
        });

        if (stock) {
          stock.qty += item.qty;
          if (item.expiry_date) stock.expiry_date = new Date(item.expiry_date);
          if (item.satuan) stock.satuan = item.satuan;
        } else {
          stock = manager.create(Stock, {
            barang,
            gudang,
            batch_no: batch_key,
            qty: item.qty,
            satuan: item.satuan || barang.satuan,
            expiry_date: item.expiry_date
              ? new Date(item.expiry_date)
              : undefined,
          });
        }
        await manager.save(Stock, stock);

        // 5. Create StockLog (type: INBOUND)
        const log = manager.create(StockLog, {
          type: LogType.INBOUND,
          no_po: plan.no_po,
          barang,
          gudang,
          qty: item.qty,
          satuan: item.satuan || barang.satuan,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date
            ? new Date(item.expiry_date)
            : undefined,
          supplier: plan.supplier,
          shift: shift || undefined,
          tanggal_income: item.tanggal_aktual,
          jam_datang: item.jam_datang,
          jam_bongkar: item.jam_bongkar,
          user: user_id ? ({ id: user_id } as any) : undefined,
          source_planning_id: plan.id,
          planned_by_username: plan.created_by_username || 'system',
          planned_at: plan.created_at,
          executed_by_username: username || 'system',
          executed_at,
        });
        await manager.save(StockLog, log);
      }

      // Keep the denormalized master-product stock in sync with rack stock.
      for (const barang_id of new Set(dto.items.map((item) => item.barang_id))) {
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

      // 6. Validate and use actual date from DTO
      for (const item of dto.items) {
        const input_date = new Date(item.tanggal_aktual);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const today_end = new Date();
        today_end.setHours(23, 59, 59, 999);

        // No future dates
        if (input_date > today_end) {
          throw new BadRequestException('Tanggal tidak boleh di masa depan');
        }

        // Past dates: admin/koordinator only
        if (input_date < today) {
          if (!['ADMIN', 'KOORDINATOR'].includes(user_role)) {
            throw new BadRequestException(
              'Hanya Admin/Koordinator yang bisa input tanggal lampau',
            );
          }
        }
      }

      // Use actual date for arrival
      const arrival_date = new Date(
        `${dto.items[0].tanggal_aktual}T${dto.items[0].jam_datang || '00:00'}`,
      );
      plan.tanggal_realisasi = arrival_date;
      if (plan.estimasi_datang) {
        plan.selisih_menit = Math.round(
          (arrival_date.getTime() - new Date(plan.estimasi_datang).getTime()) /
            60000,
        );
      }
      plan.status = 'DONE';
      plan.received_quantity = total_received;
      plan.qty_diterima = total_received;
      plan.published_at = executed_at;
      plan.executed_by_username = username || 'system';
      if (dto.note) {
        plan.note = dto.note;
      }
      await manager.save(InboundPlanning, plan);

      return plan;
    });
  }

  async remove(id: number, user_id?: number) {
    const item = await this.find_one(id);
    await this.repo.update(id, {
      deleted_at: new Date(),
      deleted_by: user_id || 0,
    });
    return { deleted: true };
  }
}
