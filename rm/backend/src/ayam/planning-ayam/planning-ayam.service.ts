import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { PlanningAyam } from './planning-ayam.entity';
import {
  CreatePlanningAyamDto,
  UpdatePlanningAyamDto,
} from './planning-ayam.dto';
import { Barang } from '../../master/barang/barang.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { OutboundAyam } from '../outbound-ayam/outbound-ayam.entity';
import { Stock } from '../../management/inventory/stock.entity';

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
    @InjectRepository(Barang) private barang_repo: Repository<Barang>,
    @InjectRepository(Shift) private shift_repo: Repository<Shift>,
    @InjectRepository(OutboundAyam)
    private outbound_ayam_repo: Repository<OutboundAyam>,
    @InjectRepository(Stock) private stock_repo: Repository<Stock>,
    private data_source: DataSource,
  ) {}

  async find_all() {
    return this.repo.find({
      where: { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async find_one(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Planning ayam tidak ditemukan');
    return item;
  }

  async find_by_status(status: string) {
    return this.repo.find({
      where: { status, deleted_at: IsNull() },
      order: { tanggal_planning: 'ASC' },
    });
  }

  async create(dto: CreatePlanningAyamDto) {
    const barang = await this.barang_repo.findOneBy({ id: dto.barang_id });
    if (!barang) throw new NotFoundException('Barang tidak ditemukan');

    const shift = dto.shift_id
      ? await this.shift_repo.findOneBy({ id: dto.shift_id })
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
    const item = await this.find_one(id);

    if (item.status !== 'WAIT') {
      throw new BadRequestException(
        `Planning dengan status '${item.status}' tidak bisa diubah. Hanya status WAIT yang bisa diedit.`,
      );
    }

    if (dto.barang_id) {
      const barang = await this.barang_repo.findOneBy({ id: dto.barang_id });
      if (!barang) throw new NotFoundException('Barang tidak ditemukan');
      (item as any).barang = barang;
    }
    if (dto.shift_id !== undefined) {
      const shift = dto.shift_id
        ? await this.shift_repo.findOneBy({ id: dto.shift_id })
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

  async update_status(id: number, new_status: string, user_id?: number) {
    const planning = await this.find_one(id);
    const current_status = planning.status;

    // Validate transition
    const allowed = this.STATUS_FLOW[current_status];
    if (!allowed || !allowed.includes(new_status)) {
      throw new BadRequestException(
        `Status tidak bisa diubah dari '${current_status}' ke '${new_status}'`,
      );
    }

    // Use transaction for stock operations
    await this.data_source.transaction(async (txn_mgr) => {
      // Re-fetch planning with relations inside transaction
      const locked = await txn_mgr.findOne(PlanningAyam, {
        where: { id: Number(id) },
        relations: ['barang'],
      });
      if (!locked) throw new NotFoundException('Planning ayam tidak ditemukan');

      const barang_id = locked.barang?.id;

      // Stock adjustment based on target status
      if (new_status === 'PROGRESS' && barang_id) {
        const stocks = await txn_mgr.find(Stock, {
          where: { barang: { id: barang_id } },
          relations: ['barang'],
        });

        const total_reserved = stocks.reduce(
          (sum, s) => sum + (s.reserved_qty || 0),
          0,
        );
        const total_available = stocks.reduce((sum, s) => sum + (s.qty || 0), 0);

        let to_reserve = locked.qty;
        for (const stock of stocks) {
          if (to_reserve <= 0) break;
          const remaining = (stock.qty || 0) - (stock.reserved_qty || 0);
          if (remaining <= 0) continue;
          const reserve_now = Math.min(remaining, to_reserve);
          stock.reserved_qty = (stock.reserved_qty || 0) + reserve_now;
          await txn_mgr.save(stock);
          to_reserve -= reserve_now;
        }

        if (to_reserve > 0) {
          throw new BadRequestException(
            `Stok tidak mencukupi. Butuh ${locked.qty}, tersedia ${total_available - total_reserved}`,
          );
        }
      }

      if (new_status === 'DONE' && barang_id) {
        const stocks = await txn_mgr.find(Stock, {
          where: { barang: { id: barang_id } },
        });

        let to_deduct = locked.qty;
        for (const stock of stocks) {
          if (to_deduct <= 0) break;
          const deduct_now = Math.min(stock.reserved_qty || 0, to_deduct);
          stock.qty = (stock.qty || 0) - deduct_now;
          stock.reserved_qty = Math.max(0, (stock.reserved_qty || 0) - deduct_now);
          await txn_mgr.save(stock);
          to_deduct -= deduct_now;
        }
      }

      if (new_status === 'CANCEL' && barang_id) {
        const stocks = await txn_mgr.find(Stock, {
          where: { barang: { id: barang_id } },
        });

        let to_release = locked.qty;
        for (const stock of stocks) {
          if (to_release <= 0) break;
          const release_now = Math.min(stock.reserved_qty || 0, to_release);
          stock.reserved_qty = Math.max(0, (stock.reserved_qty || 0) - release_now);
          await txn_mgr.save(stock);
          to_release -= release_now;
        }
      }

      // Update status
      locked.status = new_status;
      await txn_mgr.save(locked);
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

  async get_report(from?: string, to?: string) {
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
        const outbounds = await this.outbound_ayam_repo.find({
          where: { planning_ayam: { id: p.id } },
        });
        const total_outbound = outbounds.reduce(
          (sum, o) => sum + (o.qty_aktual || 0),
          0,
        );

        return {
          date: p.tanggal_planning
            ? new Date(p.tanggal_planning).toISOString().split('T')[0]
            : '-',
          planning: p.qty || 0,
          outbound: total_outbound,
          serapan:
            p.qty > 0 ? Math.round((total_outbound / p.qty) * 10000) / 100 : 0,
          status: p.status,
          barang: (p as any).barang?.nama || '-',
        };
      }),
    );

    return { rows };
  }
}
