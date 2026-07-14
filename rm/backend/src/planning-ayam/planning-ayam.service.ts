import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PlanningAyam } from './planning-ayam.entity';
import {
  CreatePlanningAyamDto,
  UpdatePlanningAyamDto,
} from './planning-ayam.dto';
import { Barang } from '../barang/barang.entity';
import { Shift } from '../shifts/shift.entity';
import { OutboundAyam } from '../outbound-ayam/outbound-ayam.entity';
import { Stock } from '../inventory/stock.entity';

@Injectable()
export class PlanningAyamService {
  private readonly STATUS_FLOW = {
    WAIT: ['PROGRESS', 'CANCEL'],
    PROGRESS: ['PUBLISH_READY', 'CANCEL'],
    PUBLISH_READY: ['DONE', 'CANCEL'],
    DONE: [],
    CANCEL: [],
  };

  constructor(
    @InjectRepository(PlanningAyam) private repo: Repository<PlanningAyam>,
    @InjectRepository(Barang) private barangRepo: Repository<Barang>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(OutboundAyam)
    private outboundAyamRepo: Repository<OutboundAyam>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Planning ayam tidak ditemukan');
    return item;
  }

  async findByStatus(status: string) {
    return this.repo.find({
      where: { status },
      order: { tanggal_planning: 'ASC' },
    });
  }

  async create(dto: CreatePlanningAyamDto) {
    const barang = await this.barangRepo.findOneBy({ id: dto.barang_id });
    if (!barang) throw new NotFoundException('Barang tidak ditemukan');

    const shift = dto.shift_id
      ? await this.shiftRepo.findOneBy({ id: dto.shift_id })
      : null;

    const item = this.repo.create({
      barang,
      qty: dto.qty,
      satuan: dto.satuan || barang.satuan,
      tanggal_planning: new Date(dto.tanggal_planning),
      shift,
      tujuan: dto.tujuan,
      status: dto.status || 'WAIT',
      keterangan: dto.keterangan,
      rak_asal: dto.rak_asal,
    } as any);

    return this.repo.save(item);
  }

  async update(id: number, dto: UpdatePlanningAyamDto) {
    const item = await this.findOne(id);

    if (dto.barang_id) {
      const barang = await this.barangRepo.findOneBy({ id: dto.barang_id });
      if (!barang) throw new NotFoundException('Barang tidak ditemukan');
      (item as any).barang = barang;
    }
    if (dto.shift_id !== undefined) {
      const shift = dto.shift_id
        ? await this.shiftRepo.findOneBy({ id: dto.shift_id })
        : null;
      (item as any).shift = shift;
    }
    if (dto.qty !== undefined) item.qty = dto.qty;
    if (dto.satuan !== undefined) item.satuan = dto.satuan;
    if (dto.tanggal_planning !== undefined)
      item.tanggal_planning = new Date(dto.tanggal_planning);
    if (dto.tujuan !== undefined) item.tujuan = dto.tujuan;
    if (dto.status !== undefined) item.status = dto.status;
    if (dto.keterangan !== undefined) item.keterangan = dto.keterangan;
    if (dto.rak_asal !== undefined) item.rak_asal = dto.rak_asal;

    return this.repo.save(item);
  }

  async updateStatus(id: number, newStatus: string, userId: number) {
    const planning = await this.findOne(id);
    const currentStatus = planning.status;

    // Validate transition
    const allowed = this.STATUS_FLOW[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Status tidak bisa diubah dari '${currentStatus}' ke '${newStatus}'`,
      );
    }

    // Use transaction with row lock for stock operations
    await this.dataSource.transaction(async (txnMgr) => {
      // Re-fetch planning with lock inside transaction
      const locked = await txnMgr.findOne(PlanningAyam, {
        where: { id },
        relations: ['barang'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Planning ayam tidak ditemukan');

      // Stock adjustment based on target status
      if (newStatus === 'PROGRESS') {
        // Reserve stock: find Stock row, lock it, check qty
        const stocks = await txnMgr.find(Stock, {
          where: { barang: { id: locked.barang.id } },
          relations: ['barang'],
          lock: { mode: 'pessimistic_write' },
        });

        const totalReserved = stocks.reduce(
          (sum, s) => sum + s.reserved_qty,
          0,
        );
        const totalAvailable = stocks.reduce((sum, s) => sum + s.qty, 0);

        // Reserve from first stock with enough remaining
        let toReserve = locked.qty;
        for (const stock of stocks) {
          if (toReserve <= 0) break;
          const remaining = stock.qty - stock.reserved_qty;
          if (remaining <= 0) continue;
          const reserveNow = Math.min(remaining, toReserve);
          stock.reserved_qty += reserveNow;
          await txnMgr.save(stock);
          toReserve -= reserveNow;
        }

        if (toReserve > 0) {
          throw new BadRequestException(
            `Stok tidak mencukupi. Butuh ${locked.qty}, tersedia ${totalAvailable - totalReserved}`,
          );
        }
      }

      if (newStatus === 'DONE') {
        // Deduct stock: reduce both qty and reserved_qty
        const stocks = await txnMgr.find(Stock, {
          where: { barang: { id: locked.barang.id } },
          lock: { mode: 'pessimistic_write' },
        });

        let toDeduct = locked.qty;
        for (const stock of stocks) {
          if (toDeduct <= 0) break;
          const deductNow = Math.min(stock.reserved_qty, toDeduct);
          stock.qty -= deductNow;
          stock.reserved_qty -= deductNow;
          await txnMgr.save(stock);
          toDeduct -= deductNow;
        }
      }

      if (newStatus === 'CANCEL') {
        // Release reserved stock
        const stocks = await txnMgr.find(Stock, {
          where: { barang: { id: locked.barang.id } },
          lock: { mode: 'pessimistic_write' },
        });

        let toRelease = locked.qty;
        for (const stock of stocks) {
          if (toRelease <= 0) break;
          const releaseNow = Math.min(stock.reserved_qty, toRelease);
          stock.reserved_qty -= releaseNow;
          // Don't let reserved_qty go below 0
          if (stock.reserved_qty < 0) stock.reserved_qty = 0;
          await txnMgr.save(stock);
          toRelease -= releaseNow;
        }
      }

      // Update status
      locked.status = newStatus;
      await txnMgr.save(locked);
    });
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    return this.repo.remove(item);
  }

  async getReport(from?: string, to?: string) {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.barang', 'barang')
      .where('barang.nama ILIKE :ayam', { ayam: '%ayam%' });

    if (from) qb.andWhere('p.tanggal_planning >= :from', { from });
    if (to) qb.andWhere('p.tanggal_planning <= :to', { to });

    const plannings = await qb.getMany();

    // For each planning, calculate outbound qty from OutboundAyam
    const rows = await Promise.all(
      plannings.map(async (p) => {
        const outbounds = await this.outboundAyamRepo.find({
          where: { planning_ayam: { id: p.id } },
        });
        const totalOutbound = outbounds.reduce(
          (sum, o) => sum + (o.qty_aktual || 0),
          0,
        );

        return {
          date: p.tanggal_planning?.toISOString().split('T')[0] || '-',
          planning: p.qty || 0,
          outbound: totalOutbound,
          serapan:
            p.qty > 0 ? Math.round((totalOutbound / p.qty) * 10000) / 100 : 0,
          status: p.status,
          barang: (p as any).barang?.nama || '-',
        };
      }),
    );

    return { rows };
  }
}
