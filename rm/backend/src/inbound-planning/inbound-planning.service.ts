import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InboundPlanning } from './inbound-planning.entity';
import {
  CreateInboundPlanningDto,
  UpdateInboundPlanningDto,
  ProcessInboundDto,
} from './inbound-planning.dto';
import { Stock } from '../inventory/stock.entity';
import { StockLog, LogType } from '../inventory/stock-log.entity';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';
import { Shift } from '../shifts/shift.entity';

@Injectable()
export class InboundPlanningService {
  constructor(
    @InjectRepository(InboundPlanning)
    private readonly repo: Repository<InboundPlanning>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockLog)
    private readonly logRepo: Repository<StockLog>,
    @InjectRepository(Barang)
    private readonly barangRepo: Repository<Barang>,
    @InjectRepository(Gudang)
    private readonly gudangRepo: Repository<Gudang>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    const now = new Date();
    const plans = await this.repo.find({
      order: { estimasi_datang: 'ASC', created_at: 'DESC' },
    });

    // Auto-fail late plans: if status is 'WAIT' and estimasi_datang is in the past
    for (const p of plans) {
      if (
        p.status === 'WAIT' &&
        p.estimasi_datang &&
        new Date(p.estimasi_datang) < now
      ) {
        p.status = 'FAIL';
        await this.repo.update(p.id, { status: 'FAIL' });
      }
    }

    return plans;
  }

  async findOne(id: number) {
    const item = await this.repo.findOneBy({ id });
    if (!item)
      throw new NotFoundException(`Inbound planning with ID ${id} not found`);
    return item;
  }

  create(dto: CreateInboundPlanningDto) {
    const item = this.repo.create({
      ...dto,
      estimasi_datang: dto.estimasi_datang
        ? new Date(dto.estimasi_datang)
        : undefined,
    });
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateInboundPlanningDto) {
    const item = await this.findOne(id);
    const data: any = { ...dto };
    if (dto.estimasi_datang) {
      data.estimasi_datang = new Date(dto.estimasi_datang);
    }
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async processInbound(id: number, dto: ProcessInboundDto) {
    return this.dataSource.transaction(async (manager) => {
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
      if (dto.shiftId) {
        shift = await manager.findOneBy(Shift, { id: dto.shiftId });
      }

      let totalReceived = 0;

      for (const item of dto.items) {
        // 3. Validate barang & gudang exist
        const barang = await manager.findOneBy(Barang, { id: item.barangId });
        if (!barang) {
          throw new BadRequestException(`Barang ID ${item.barangId} not found`);
        }

        const gudang = await manager.findOneBy(Gudang, { id: item.gudangId });
        if (!gudang) {
          throw new BadRequestException(`Gudang ID ${item.gudangId} not found`);
        }

        totalReceived += item.qty;

        // 4. Upsert stock (Barang+Gudang+batch_no)
        const batchKey = item.batch_no || '';
        let stock = await manager.findOne(Stock, {
          where: {
            barang: { id: barang.id },
            gudang: { id: gudang.id },
            batch_no: batchKey,
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
            batch_no: batchKey,
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
          jam_datang: item.jam_datang,
          jam_bongkar: item.jam_bongkar,
        });
        await manager.save(StockLog, log);
      }

      // 6. Update planning: status='DONE', received_quantity, published_at=now
      let arrivalDate = new Date();
      const firstItem = dto.items[0];
      if (firstItem && firstItem.jam_datang) {
        const todayStr = new Date().toISOString().split('T')[0];
        const parsed = new Date(`${todayStr}T${firstItem.jam_datang}`);
        if (!isNaN(parsed.getTime())) {
          arrivalDate = parsed;
        }
      }
      let selisih = 0;
      if (plan.estimasi_datang) {
        selisih = Math.round(
          (arrivalDate.getTime() - new Date(plan.estimasi_datang).getTime()) /
            60000,
        );
      }
      plan.tanggal_realisasi = arrivalDate;
      plan.selisih_menit = selisih;
      plan.status = 'DONE';
      plan.received_quantity = totalReceived;
      plan.qty_diterima = totalReceived;
      plan.published_at = new Date();
      if (dto.note) {
        plan.note = dto.note;
      }
      await manager.save(InboundPlanning, plan);

      return plan;
    });
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    await this.repo.remove(item);
    return { deleted: true };
  }
}
