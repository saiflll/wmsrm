import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, ILike, In, LessThan } from 'typeorm';
import { Stock } from './stock.entity';
import { StockLog, LogType } from './stock-log.entity';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { InboundPlanning } from '../../inbound/inbound-planning/inbound-planning.entity';
import { PlanningAyam } from '../../ayam/planning-ayam/planning-ayam.entity';
import { OutboundAyam } from '../../ayam/outbound-ayam/outbound-ayam.entity';
import {
  InboundItemDto,
  OutboundItemDto,
  RelocationDto,
  OpnameDto,
  PickingItemDto,
} from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Stock) private stock_repo: Repository<Stock>,
    @InjectRepository(StockLog) private log_repo: Repository<StockLog>,
    @InjectRepository(Barang) private barang_repo: Repository<Barang>,
    @InjectRepository(Gudang) private gudang_repo: Repository<Gudang>,
    @InjectRepository(Shift) private shift_repo: Repository<Shift>,
    @InjectRepository(InboundPlanning)
    private inbound_planning_repo: Repository<InboundPlanning>,
    @InjectRepository(PlanningAyam)
    private planning_ayam_repo: Repository<PlanningAyam>,
    @InjectRepository(OutboundAyam)
    private outbound_ayam_repo: Repository<OutboundAyam>,
    private data_source: DataSource,
  ) {}

  private async sync_barang_stok(manager: any, barang_id: number) {
    const result = await manager
      .getRepository(Stock)
      .createQueryBuilder('s')
      .where('s.barangId = :barangId', { barangId: barang_id })
      .select('SUM(s.qty)', 'total')
      .getRawOne();
    const total = parseFloat(result?.total || '0');
    await manager.update(Barang, barang_id, { stok: total });
  }

  async sync_all_barang_stok() {
    return this.data_source.transaction(async (manager) => {
      const barangs = await manager.find(Barang);
      for (const b of barangs) {
        await this.sync_barang_stok(manager, b.id);
      }
      return { message: `Synced ${barangs.length} items` };
    });
  }

  // ========== INBOUND ==========
  async post_inbound(items: InboundItemDto[], user_id?: number, username?: string) {
    return this.data_source.transaction(async (manager) => {
      const logs: StockLog[] = [];
      const executed_at = new Date();

      for (const item of items) {
        const barang = await manager.findOneBy(Barang, { id: item.barang_id });
        if (!barang)
          throw new BadRequestException(
            `Barang ID ${item.barang_id} not found`,
          );

        const gudang = await manager.findOneBy(Gudang, { id: item.gudang_id });
        if (!gudang)
          throw new BadRequestException(
            `Gudang ID ${item.gudang_id} not found`,
          );

        const shift = item.shift_id
          ? await manager.findOneBy(Shift, { id: item.shift_id })
          : null;

        // Upsert stock: find existing or create
        let stock = await manager.findOne(Stock, {
          where: {
            barang: { id: barang.id },
            gudang: { id: gudang.id },
            batch_no: item.batch_no || '',
          },
        });

        if (stock) {
          stock.qty += item.qty;
          if (item.expiry_date) stock.expiry_date = new Date(item.expiry_date);
        } else {
          stock = manager.create(Stock, {
            barang,
            gudang,
            batch_no: item.batch_no || '',
            lot_no: item.lot_no || '',
            qty: item.qty,
            satuan: item.satuan || barang.satuan,
            expiry_date: item.expiry_date
              ? new Date(item.expiry_date)
              : undefined,
          } as any);
        }
        await manager.save(Stock, stock);
        await this.sync_barang_stok(manager, barang.id);

        // Create log
        const log = manager.create(StockLog, {
          type: LogType.INBOUND,
          no_po: item.no_po,
          barang,
          gudang,
          qty: item.qty,
          satuan: item.satuan || barang.satuan,
          batch_no: item.batch_no,
          lot_no: item.lot_no,
          expiry_date: item.expiry_date
            ? new Date(item.expiry_date)
            : undefined,
          supplier: item.supplier,
          shift: shift || undefined,
          jam_datang: item.jam_datang,
          tanggal_income: item.tanggal_income,
          jam_bongkar: item.jam_bongkar,
          jam_selesai: item.jam_selesai,
          note: item.note,
          keterangan: item.keterangan,
          user: user_id ? ({ id: user_id } as any) : undefined,
          executed_by_username: username || 'system',
          executed_at,
        } as any);
        await manager.save(StockLog, log);
        logs.push(log);

        // Check if there is an inbound planning with this PO
        const plan = await manager.findOne(InboundPlanning, {
          where: { no_po: item.no_po },
        });
        if (plan && plan.status !== 'DONE') {
          log.source_planning_id = plan.id;
          log.planned_by_username = plan.created_by_username || 'system';
          log.planned_at = plan.created_at;
          await manager.save(StockLog, log);
          let arrival_date = new Date();
          if (item.tanggal_income) {
            const base = item.tanggal_income;
            const time = item.jam_datang || '00:00';
            const parsed = new Date(`${base}T${time}`);
            if (!isNaN(parsed.getTime())) {
              arrival_date = parsed;
            }
          }
          let selisih = 0;
          if (plan.estimasi_datang) {
            selisih = Math.round(
              (arrival_date.getTime() -
                new Date(plan.estimasi_datang).getTime()) /
                60000,
            );
          }
          plan.status = 'DONE';
          plan.tanggal_realisasi = arrival_date;
          plan.selisih_menit = selisih;
          plan.published_at = executed_at;
          plan.executed_by_username = username || 'system';
          await manager.save(InboundPlanning, plan);
        }
      }
      return logs;
    });
  }

  // ========== OUTBOUND (Picking) ==========
  async post_outbound(items: OutboundItemDto[], user_id?: number, username?: string) {
    return this.data_source.transaction(async (manager) => {
      const logs: StockLog[] = [];
      const executed_at = new Date();

      for (const item of items) {
        const barang = await manager.findOneBy(Barang, { id: item.barang_id });
        if (!barang)
          throw new BadRequestException(
            `Barang ID ${item.barang_id} not found`,
          );

        const gudang = await manager.findOneBy(Gudang, { id: item.gudang_id });
        if (!gudang)
          throw new BadRequestException(
            `Gudang ID ${item.gudang_id} not found`,
          );

        // Find stock in this location
        const stock = await manager.findOne(Stock, {
          where: {
            barang: { id: barang.id },
            gudang: { id: gudang.id },
            ...(item.batch_no ? { batch_no: item.batch_no } : {}),
          },
        });

        if (!stock) {
          throw new BadRequestException(
            `Stok tidak ditemukan untuk ${barang.nama} di ${gudang.name}`,
          );
        }

        const available_qty = stock.qty - stock.reserved_qty;
        if (available_qty < item.qty) {
          throw new BadRequestException(
            `Stok tersedia tidak cukup untuk ${barang.nama} di ${gudang.name} (Tersedia: ${available_qty}, Diminta: ${item.qty})`,
          );
        }

        // Deduct physical stock quantity
        stock.qty -= item.qty;
        await manager.save(Stock, stock);

        // Clean up empty stock
        if (stock.qty <= 0) {
          await manager.remove(Stock, stock);
        }

        await this.sync_barang_stok(manager, barang.id);

        const shift = item.shift_id
          ? await manager.findOneBy(Shift, { id: item.shift_id })
          : null;

        const log = manager.create(StockLog, {
          type: LogType.OUTBOUND,
          status: 'CONFIRMED',
          no_ref: item.no_ref,
          barang,
          gudang,
          qty: item.qty,
          satuan: item.satuan || barang.satuan,
          tujuan: item.tujuan,
          shift: shift || undefined,
          batch_no: stock.batch_no,
          expiry_date: stock.expiry_date,
          note: item.note,
          keterangan: item.keterangan,
          jam_datang: item.jam_datang,
          jam_bongkar: item.jam_bongkar,
          jam_selesai: item.jam_selesai,
          user: user_id ? ({ id: user_id } as any) : undefined,
          executed_by_username: username || 'system',
          executed_at,
        } as any);
        await manager.save(StockLog, log);
        logs.push(log);
      }
      return logs;
    });
  }

  // ========== PICKING PLAN ==========
  async post_picking(items: PickingItemDto[], user_id?: number) {
    return this.data_source.transaction(async (manager) => {
      const logs: StockLog[] = [];

      for (const item of items) {
        const barang = await manager.findOneBy(Barang, { id: item.barang_id });
        if (!barang)
          throw new BadRequestException(
            `Barang ID ${item.barang_id} not found`,
          );

        const gudang = await manager.findOneBy(Gudang, { id: item.gudang_id });
        if (!gudang)
          throw new BadRequestException(
            `Gudang ID ${item.gudang_id} not found`,
          );

        // Find stock
        const stock = await manager.findOne(Stock, {
          where: {
            barang: { id: barang.id },
            gudang: { id: gudang.id },
            ...(item.batch_no ? { batch_no: item.batch_no } : {}),
          },
        });

        if (!stock) {
          throw new BadRequestException(
            `Stok tidak ditemukan untuk ${barang.nama} di ${gudang.name}`,
          );
        }

        const actual_qty =
          item.actual_qty !== undefined && item.actual_qty !== null
            ? item.actual_qty
            : item.qty;
        const available_qty = stock.qty - stock.reserved_qty;
        if (available_qty < actual_qty) {
          throw new BadRequestException(
            `Stok tersedia tidak cukup untuk ${barang.nama} di ${gudang.name}. ` +
              `Tersedia: ${available_qty} (Total: ${stock.qty}, Reserved: ${stock.reserved_qty}), Diminta: ${actual_qty}`,
          );
        }

        // Increment reserved_qty by actual qty
        stock.reserved_qty += actual_qty;
        await manager.save(Stock, stock);

        const shift = item.shift_id
          ? await manager.findOneBy(Shift, { id: item.shift_id })
          : null;

        const log = manager.create(StockLog, {
          type: LogType.PICKING,
          status: 'RESERVED',
          no_ref: item.no_ref,
          barang,
          gudang,
          qty: item.qty,
          actual_qty: actual_qty,
          alokasi: item.alokasi || [],
          keterangan: item.keterangan,
          satuan: item.satuan || barang.satuan,
          tujuan: item.tujuan,
          shift: shift || undefined,
          batch_no: stock.batch_no,
          expiry_date: stock.expiry_date,
          user: user_id ? ({ id: user_id } as any) : undefined,
        } as any);
        await manager.save(StockLog, log);
        logs.push(log);
      }
      return logs;
    });
  }

  async confirm_picking(no_ref: string, user_id?: number) {
    return this.data_source.transaction(async (manager) => {
      const logs = await manager.find(StockLog, {
        where: { no_ref: no_ref, type: LogType.PICKING, status: 'RESERVED' },
        relations: ['barang', 'gudang'],
      });

      if (!logs.length) {
        throw new NotFoundException(
          'Picking plan dengan status RESERVED tidak ditemukan',
        );
      }

      for (const log of logs) {
        // Find stock
        const stock = await manager.findOne(Stock, {
          where: {
            barang: { id: log.barang.id },
            gudang: { id: log.gudang.id },
            ...(log.batch_no ? { batch_no: log.batch_no } : {}),
          },
        });

        if (!stock) {
          throw new BadRequestException(
            `Stok tidak ditemukan untuk ${log.barang?.nama || 'item'} di ${log.gudang?.name || 'gudang'}. ` +
              `Stok mungkin telah dipindahkan atau dihapus setelah picking dibuat.`,
          );
        }

        const actual_qty =
          log.actual_qty !== undefined && log.actual_qty !== null
            ? log.actual_qty
            : log.qty;
        if (stock.qty < actual_qty) {
          throw new BadRequestException(
            `Stok fisik tidak cukup untuk ${log.barang?.nama || 'item'} di ${log.gudang?.name || 'gudang'}. ` +
              `Tersedia: ${stock.qty}, Diminta: ${actual_qty}. ` +
              `Stok mungkin telah dikeluarkan oleh transaksi lain.`,
          );
        }

        // Deduct physical qty and reserved_qty
        stock.qty -= actual_qty;
        stock.reserved_qty = Math.max(0, stock.reserved_qty - actual_qty);

        if (stock.qty <= 0) {
          await manager.remove(Stock, stock);
        } else {
          await manager.save(Stock, stock);
        }

        await this.sync_barang_stok(manager, log.barang.id);

        // Update log type and status to indicate checkout
        log.type = LogType.OUTBOUND;
        log.status = 'CONFIRMED';
        await manager.save(StockLog, log);
      }

      return { message: 'Picking plan confirmed and checked out successfully' };
    });
  }

  async cancel_picking(no_ref: string, user_id?: number) {
    return this.data_source.transaction(async (manager) => {
      const logs = await manager.find(StockLog, {
        where: { no_ref: no_ref, type: LogType.PICKING, status: 'RESERVED' },
        relations: ['barang', 'gudang'],
      });

      if (!logs.length) {
        throw new NotFoundException('Picking plan tidak ditemukan');
      }

      for (const log of logs) {
        const stock = await manager.findOne(Stock, {
          where: {
            barang: { id: log.barang.id },
            gudang: { id: log.gudang.id },
            ...(log.batch_no ? { batch_no: log.batch_no } : {}),
          },
        });

        if (stock) {
          const actual_qty =
            log.actual_qty !== undefined && log.actual_qty !== null
              ? log.actual_qty
              : log.qty;
          stock.reserved_qty = Math.max(0, stock.reserved_qty - actual_qty);
          await manager.save(Stock, stock);
        }

        // Delete the log
        await manager.remove(StockLog, log);
      }

      return { message: 'Picking plan cancelled successfully' };
    });
  }

  async get_pending_pickings() {
    const logs = await this.log_repo.find({
      where: { type: LogType.PICKING, status: 'RESERVED' },
      relations: ['barang', 'gudang', 'shift'],
      order: { created_at: 'DESC' },
    });

    // Group logs by no_ref
    const groups: Record<string, any> = {};
    for (const log of logs) {
      const key = log.no_ref || 'NO_REF';
      if (!groups[key]) {
        groups[key] = {
          no_ref: key,
          tujuan: log.tujuan || '-',
          shift: log.shift?.name || '-',
          created_at: log.created_at,
          items: [],
        };
      }
      groups[key].items.push(log);
    }

    return Object.values(groups);
  }

  // ========== REVERT OUTBOUND ==========
  async revert_outbound(no_ref: string, user_id?: number) {
    return this.data_source.transaction(async (manager) => {
      const logs = await manager.find(StockLog, {
        where: { no_ref: no_ref, type: LogType.OUTBOUND },
        relations: ['barang', 'gudang'],
      });

      if (!logs.length)
        throw new NotFoundException('Transaksi tidak ditemukan');

      for (const log of logs) {
        // Return barang total stock - will be synced after loop

        // Restore to rack
        let stock = await manager.findOne(Stock, {
          where: {
            barang: { id: log.barang.id },
            gudang: { id: log.gudang.id },
            batch_no: log.batch_no || '',
          },
        });

        if (stock) {
          stock.qty += log.qty;
        } else {
          stock = manager.create(Stock, {
            barang: log.barang,
            gudang: log.gudang,
            qty: log.qty,
            satuan: log.satuan,
            batch_no: log.batch_no,
            expiry_date: log.expiry_date,
          });
        }
        await manager.save(Stock, stock);

        // Delete log
        await manager.remove(StockLog, log);
        await this.sync_barang_stok(manager, log.barang.id);
      }
      return { message: 'Reverted successfully' };
    });
  }

  // ========== RELOCATION ==========
  async relocate(dto: RelocationDto, user_id?: number) {
    return this.data_source.transaction(async (manager) => {
      const stock = await manager.findOne(Stock, {
        where: { id: dto.stock_id },
        relations: ['barang', 'gudang'],
      });
      if (!stock) throw new NotFoundException('Stock not found');
      if (stock.qty < dto.qty)
        throw new BadRequestException('Qty melebihi stok');

      const tujuan = await manager.findOneBy(Gudang, {
        id: dto.gudang_tujuan_id,
      });
      if (!tujuan) throw new NotFoundException('Gudang tujuan not found');

      // Save source values for logging before modifying
      const source_gudang = stock.gudang;

      // Increase destination
      let dest_stock = await manager.findOne(Stock, {
        where: {
          barang: { id: stock.barang.id },
          gudang: { id: tujuan.id },
          batch_no: stock.batch_no,
        },
      });
      if (dest_stock) {
        dest_stock.qty += dto.qty;
      } else {
        dest_stock = manager.create(Stock, {
          barang: stock.barang,
          gudang: tujuan,
          batch_no: stock.batch_no,
          lot_no: stock.lot_no,
          qty: dto.qty,
          satuan: stock.satuan,
          expiry_date: stock.expiry_date,
        });
      }
      await manager.save(Stock, dest_stock);

      // Log
      const log = manager.create(StockLog, {
        type: LogType.RELOCATION,
        no_po: dto.no_po,
        barang: stock.barang,
        gudang: stock.gudang,
        gudang_tujuan: tujuan,
        qty: dto.qty,
        satuan: stock.satuan,
        batch_no: stock.batch_no,
        expiry_date: stock.expiry_date,
        note: dto.note,
        user: user_id ? ({ id: user_id } as any) : undefined,
      } as any);
      await manager.save(StockLog, log);

      // Decrease source LAST
      if (stock.qty <= 0) {
        await manager.remove(Stock, stock);
      } else {
        await manager.save(Stock, stock);
      }

      await this.sync_barang_stok(manager, stock.barang.id);

      return log;
    });
  }

  // ========== STOCK OPNAME ==========
  async opname(dto: OpnameDto, user_id?: number) {
    if (!dto.shift_id) {
      throw new BadRequestException(
        'Shift wajib dipilih untuk melakukan opname.',
      );
    }

    return this.data_source.transaction(async (manager) => {
      const today = new Date().toISOString().split('T')[0];

      const stocks = await manager.find(Stock, {
        where: { gudang: { id: dto.gudang_id } },
        relations: ['barang', 'gudang'],
      });

      if (!stocks.length)
        throw new NotFoundException('Stock not found at this location');

      const total_old_qty = stocks.reduce((sum, s) => sum + s.qty, 0);
      const diff = dto.qty_opname - total_old_qty;

      // Reorder so that the target stock_id is processed last (absorbs the diff)
      const target_index = dto.stock_id
        ? stocks.findIndex((s) => s.id === dto.stock_id)
        : 0;
      const primary_stock = stocks.splice(
        target_index !== -1 ? target_index : 0,
        1,
      )[0];
      stocks.push(primary_stock); // primaryStock is now at the END of the array

      const existing_log = await manager.findOne(StockLog, {
        where: {
          gudang: { id: dto.gudang_id },
          type: LogType.OPNAME,
          shift: { id: dto.shift_id },
          created_at: Between(new Date(today), new Date(today + 'T23:59:59')),
        },
        relations: ['shift'],
      });

      if (existing_log) {
        // Allow re-opname (update) for coordinator and above
        // Update existing log instead of throwing error
        let remaining_opname = dto.qty_opname;
        for (let i = 0; i < stocks.length; i++) {
          const s = stocks[i];
          if (i === stocks.length - 1) {
            s.qty = remaining_opname;
          } else {
            const assign = Math.min(s.qty, remaining_opname);
            s.qty = assign;
            remaining_opname -= assign;
          }
          if (s.qty <= 0) {
            await manager.remove(Stock, s);
          } else {
            await manager.save(Stock, s);
          }
        }

        await this.sync_barang_stok(manager, primary_stock.barang.id);

        existing_log.qty = dto.qty_opname;
        existing_log.note =
          dto.note ||
          `Opname Rak (Update): ${total_old_qty} → ${dto.qty_opname} (diff: ${diff > 0 ? '+' : ''}${diff})`;
        existing_log.keterangan = dto.keterangan ?? null;
        existing_log.created_at = new Date();
        await manager.save(StockLog, existing_log);

        return { stock: primary_stock, log: existing_log, diff, updated: true };
      }

      let remaining_opname = dto.qty_opname;

      // Distribute the new qty_opname across available stocks
      for (let i = 0; i < stocks.length; i++) {
        const s = stocks[i];
        if (i === stocks.length - 1) {
          s.qty = remaining_opname; // Last one takes whatever is left
        } else {
          const assign = Math.min(s.qty, remaining_opname);
          s.qty = assign;
          remaining_opname -= assign;
        }

        if (s.qty <= 0) {
          await manager.remove(Stock, s);
        } else {
          await manager.save(Stock, s);
        }
      }

      // Sync global stock
      await this.sync_barang_stok(manager, primary_stock.barang.id);

      // Resolve shift if provided
      const shift = dto.shift_id
        ? await manager.findOneBy(Shift, { id: dto.shift_id })
        : null;

      const log = manager.create(StockLog, {
        type: LogType.OPNAME,
        barang: primary_stock.barang,
        gudang: primary_stock.gudang,
        qty: dto.qty_opname,
        satuan: primary_stock.satuan,
        shift: shift || undefined,
        note:
          dto.note ||
          `Opname Rak: ${total_old_qty} → ${dto.qty_opname} (diff: ${diff > 0 ? '+' : ''}${diff})`,
        keterangan: dto.keterangan,
        user: user_id ? ({ id: user_id } as any) : undefined,
      } as any);
      await manager.save(StockLog, log);

      return { stock: primary_stock, log, diff };
    });
  }

  // ========== QUERIES ==========
  async find_all_stock(
    side?: boolean,
    search?: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const where: any = {};
    if (side !== undefined) where.barang = { side };
    if (search) where.barang = { ...where.barang, nama: ILike(`%${search}%`) };

    const [data, total] = await this.stock_repo.findAndCount({
      where,
      relations: ['barang', 'gudang'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  find_stock_by_gudang(gudang_id: number) {
    return this.stock_repo.find({
      where: { gudang: { id: gudang_id } },
      relations: ['barang', 'gudang'],
    });
  }

  find_stock_by_barang(barang_id: number) {
    return this.stock_repo.find({
      where: { barang: { id: barang_id } },
      relations: ['barang', 'gudang'],
    });
  }

  async get_expired_alerts(gudang_id?: number) {
    const now = new Date();
    const thirty_days_from_now = new Date();
    thirty_days_from_now.setDate(thirty_days_from_now.getDate() + 30);

    const where: any = {};
    if (gudang_id) where.gudang = { id: gudang_id };

    const expired = await this.stock_repo.find({
      where: { ...where, expiry_date: LessThan(now) },
      relations: ['barang', 'gudang'],
      order: { expiry_date: 'ASC' },
    });

    const near_expired = await this.stock_repo.find({
      where: {
        ...where,
        expiry_date: Between(now, thirty_days_from_now),
      },
      relations: ['barang', 'gudang'],
      order: { expiry_date: 'ASC' },
    });

    return {
      expired: expired.map((s) => ({
        id: s.id,
        barang: s.barang?.nama,
        sku: s.barang?.sku,
        batch: s.batch_no,
        qty: s.qty,
        gudang: s.gudang?.name,
        expiry: s.expiry_date?.toISOString().split('T')[0],
        days_overdue: Math.floor(
          (now.getTime() - s.expiry_date.getTime()) / 86400000,
        ),
      })),
      near_expired: near_expired.map((s) => ({
        id: s.id,
        barang: s.barang?.nama,
        sku: s.barang?.sku,
        batch: s.batch_no,
        qty: s.qty,
        gudang: s.gudang?.name,
        expiry: s.expiry_date?.toISOString().split('T')[0],
        days_left: Math.floor(
          (s.expiry_date.getTime() - now.getTime()) / 86400000,
        ),
      })),
    };
  }

  // Logs with filters
  find_logs(filters: {
    type?: LogType;
    from?: string;
    to?: string;
    shift_id?: number;
    search?: string;
  }) {
    const where: any = {};
    if (filters.type) where.type = filters.type;
    if (filters.shift_id) where.shift = { id: filters.shift_id };
    if (filters.from && filters.to) {
      where.created_at = Between(
        new Date(filters.from),
        new Date(filters.to + 'T23:59:59'),
      );
    }

    return this.log_repo.find({
      where,
      relations: ['barang', 'gudang', 'gudang_tujuan', 'shift', 'user'],
      order: { created_at: 'DESC' },
      take: 500,
    });
  }

  // Dashboard stats
  async get_dashboard_stats() {
    // totalSku: count distinct barang that has stock (qty > 0)
    const total_sku_result = await this.stock_repo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.barangId)', 'cnt')
      .where('s.qty > 0')
      .getRawOne();
    const total_sku = Number(total_sku_result?.cnt || 0);

    // totalStock: sum all stock quantities
    const total_stock_result = await this.stock_repo
      .createQueryBuilder('s')
      .select('SUM(s.qty)', 'total')
      .getRawOne();
    const total_stock = Number(total_stock_result?.total || 0);

    // inboundHariIni: count inbound logs created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const inbound_hari_ini_result = await this.log_repo
      .createQueryBuilder('l')
      .where(
        'l.type = :type AND l.created_at >= :today AND l.created_at < :tomorrow',
        {
          type: LogType.INBOUND,
          today,
          tomorrow,
        },
      )
      .select('COUNT(l.id)', 'cnt')
      .getRawOne();
    const inbound_hari_ini = Number(inbound_hari_ini_result?.cnt || 0);

    // outboundHariIni: count outbound logs created today
    const outbound_hari_ini_result = await this.log_repo
      .createQueryBuilder('l')
      .where(
        'l.type = :type AND l.created_at >= :today AND l.created_at < :tomorrow',
        {
          type: LogType.OUTBOUND,
          today,
          tomorrow,
        },
      )
      .select('COUNT(l.id)', 'cnt')
      .getRawOne();
    const outbound_hari_ini = Number(outbound_hari_ini_result?.cnt || 0);

    const picking_pending_count_raw = await this.log_repo
      .createQueryBuilder('l')
      .where('l.type = :type AND l.status = :status', {
        type: LogType.PICKING,
        status: 'RESERVED',
      })
      .select('COUNT(DISTINCT l.no_ref)', 'cnt')
      .getRawOne();
    const picking_pending_count = Number(picking_pending_count_raw?.cnt || 0);

    // Gudang utilization
    const total_slots = await this.gudang_repo.count();
    const filled_slots = await this.stock_repo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.gudangId)', 'cnt')
      .getRawOne();

    // Expired alerts
    const now = new Date();
    const thirty_days_from_now = new Date();
    thirty_days_from_now.setDate(thirty_days_from_now.getDate() + 30);

    const expired_count_raw = await this.stock_repo
      .createQueryBuilder('s')
      .where('s.expiry_date < :now', { now })
      .select('COUNT(s.id)', 'cnt')
      .getRawOne();
    const expired_count = Number(expired_count_raw?.cnt || 0);

    const near_expired_count_raw = await this.stock_repo
      .createQueryBuilder('s')
      .where('s.expiry_date >= :now AND s.expiry_date <= :thirtyDaysFromNow', {
        now,
        thirtyDaysFromNow: thirty_days_from_now,
      })
      .select('COUNT(s.id)', 'cnt')
      .getRawOne();
    const near_expired_count = Number(near_expired_count_raw?.cnt || 0);

    // Waste count
    const waste_count_raw = await this.stock_repo
      .createQueryBuilder('s')
      .leftJoin('s.gudang', 'g')
      .where('g.zone = :zone', { zone: 'WASTE' })
      .select('COUNT(s.id)', 'cnt')
      .getRawOne();
    const waste_count = Number(waste_count_raw?.cnt || 0);

    // Summary Waktu
    const parse_time_to_minutes = (t: string) => {
      if (!t) return null;
      const parts = t.split(':');
      if (parts.length < 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };

    const thirty_days_ago = new Date();
    thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);
    const inbound_logs = await this.log_repo.find({
      where: {
        type: LogType.INBOUND,
        created_at: Between(thirty_days_ago, new Date()),
      },
    });

    let total_wait_time = 0;
    let total_unload_time = 0;
    let wait_count = 0;
    let unload_count = 0;

    for (const log of inbound_logs) {
      const t_datang = parse_time_to_minutes(log.jam_datang);
      const t_bongkar = parse_time_to_minutes(log.jam_bongkar);
      const t_selesai = parse_time_to_minutes(log.jam_selesai);

      if (t_datang !== null && t_bongkar !== null && t_bongkar >= t_datang) {
        total_wait_time += t_bongkar - t_datang;
        wait_count++;
      }
      if (t_bongkar !== null && t_selesai !== null && t_selesai >= t_bongkar) {
        total_unload_time += t_selesai - t_bongkar;
        unload_count++;
      }
    }

    const avg_waiting_time =
      wait_count > 0 ? Math.round(total_wait_time / wait_count) : 0;
    const avg_unloading_time =
      unload_count > 0 ? Math.round(total_unload_time / unload_count) : 0;

    // Inbound Driver Planning stats
    const plan_wait_count = await this.stock_repo.manager.count(InboundPlanning, {
      where: { status: 'WAIT' },
    });
    const plan_fail_count = await this.stock_repo.manager.count(InboundPlanning, {
      where: { status: 'FAIL' },
    });
    const plan_done_count = await this.stock_repo.manager.count(InboundPlanning, {
      where: { status: 'DONE' },
    });

    const delay_result = await this.stock_repo.manager
      .getRepository(InboundPlanning)
      .createQueryBuilder('p')
      .where('p.status = :status AND p.selisih_menit IS NOT NULL', {
        status: 'DONE',
      })
      .select('AVG(p.selisih_menit)', 'avg')
      .getRawOne();
    const avg_delay = delay_result?.avg
      ? Math.round(parseFloat(delay_result.avg))
      : 0;

    return {
      total_sku,
      total_stock,
      inboundCount: inbound_hari_ini,
      outboundCount: outbound_hari_ini,
      inbound_hari_ini,
      outbound_hari_ini,
      picking_pending_count,
      total_slots,
      filled_slots: Number(filled_slots?.cnt || 0),
      utilization:
        total_slots > 0
          ? ((Number(filled_slots?.cnt || 0) / total_slots) * 100).toFixed(1)
          : '0',
      expired_count,
      near_expired_count,
      waste_count,
      avg_waiting_time,
      avg_unloading_time,
      plan_wait_count,
      plan_fail_count,
      plan_done_count,
      avg_delay,
    };
  }

  async get_in_out_chart_data() {
    const one_year_ago = new Date();
    one_year_ago.setDate(one_year_ago.getDate() - 365);

    const logs = await this.log_repo.find({
      where: {
        created_at: Between(one_year_ago, new Date()),
      },
      order: { created_at: 'ASC' },
    });

    const weekly_data: Record<string, { inbound: number; outbound: number }> =
      {};

    const get_monday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(date.setDate(diff));
      return mon.toISOString().split('T')[0];
    };

    for (const log of logs) {
      if (log.type !== LogType.INBOUND && log.type !== LogType.OUTBOUND)
        continue;
      const mon_str = get_monday(log.created_at);
      if (!weekly_data[mon_str]) {
        weekly_data[mon_str] = { inbound: 0, outbound: 0 };
      }
      if (log.type === LogType.INBOUND) {
        weekly_data[mon_str].inbound += log.qty;
      } else if (log.type === LogType.OUTBOUND) {
        weekly_data[mon_str].outbound += log.qty;
      }
    }

    const sorted_weeks = Object.keys(weekly_data).sort();
    return sorted_weeks.map((week_str) => ({
      week: week_str,
      inbound: Math.round(weekly_data[week_str].inbound),
      outbound: Math.round(weekly_data[week_str].outbound),
    }));
  }

  // Stock chart data - daily stock levels per product (last 30 days)
  async get_stock_chart_data(barang_id?: number) {
    const thirty_days_ago = new Date();
    thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);
    const today = new Date();

    // Generate date range
    const dates: string[] = [];
    for (
      let d = new Date(thirty_days_ago);
      d <= today;
      d.setDate(d.getDate() + 1)
    ) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Get all products
    const where: any = {};
    if (barang_id) where.id = barang_id;
    const barangs = await this.barang_repo.find({ where });

    // Get logs in date range (only INBOUND/OUTBOUND)
    const logs = await this.log_repo.find({
      where: {
        created_at: Between(
          thirty_days_ago,
          new Date(today.getTime() + 86400000),
        ),
        type: In([LogType.INBOUND, LogType.OUTBOUND]),
        ...(barang_id ? { barang: { id: barang_id } } : {}),
      },
      relations: ['barang'],
      order: { created_at: 'ASC' },
    });

    // Group net changes by barang_id and date
    const changes: Record<number, Record<string, number>> = {};
    for (const log of logs) {
      if (!log.barang) continue;
      const bid = log.barang.id;
      const dt = log.created_at.toISOString().split('T')[0];
      if (!changes[bid]) changes[bid] = {};
      changes[bid][dt] =
        (changes[bid][dt] || 0) +
        (log.type === LogType.INBOUND ? log.qty : -log.qty);
    }

    // Get current stock per product
    const current_stocks: Record<number, number> = {};
    const stock_rows = await this.stock_repo
      .createQueryBuilder('s')
      .select('s.barangId', 'barang_id')
      .addSelect('SUM(s.qty)', 'qty')
      .groupBy('s.barangId')
      .getRawMany();
    for (const row of stock_rows) {
      current_stocks[row.barang_id] = parseFloat(row.qty) || 0;
    }

    // Build series: work backwards from current stock
    const series: any[] = [];
    for (const brg of barangs) {
      const cur_stock = current_stocks[brg.id] || 0;
      // Compute cumulative forward stock
      let running = 0;
      const data_points = dates.map((dt) => {
        const net = changes[brg.id]?.[dt] || 0;
        running += net;
        return { date: dt, net };
      });

      // Current stock = sum of all net changes up to today + starting stock
      // starting stock = curStock - total net change
      const total_net = data_points.reduce((s, d) => s + d.net, 0);
      const starting_stock = Math.max(0, cur_stock - total_net);

      // Compute cumulative stock level
      let cum = starting_stock;
      const stock_data = data_points.map((d) => {
        cum += d.net;
        return { date: d.date, stock: Math.round(cum * 10) / 10 };
      });

      series.push({
        id: brg.id,
        nama: brg.nama,
        satuan: brg.satuan,
        color:
          brg.kategori === 'Wet'
            ? '#fcc419'
            : brg.kategori === 'Waste'
              ? '#845ef7'
              : '#1c7ed6',
        data: stock_data,
      });
    }

    return { dates, series };
  }

  // Occupancy data: capacity usage per zone
  async get_occupancy_data(zone?: string, from?: string, to?: string) {
    const gudangs = await this.gudang_repo.find({ order: { id: 'ASC' } });
    const stocks = await this.stock_repo.find({ relations: ['gudang'] });

    const zone_color: Record<string, string> = {
      A: '#228be6',
      B: '#40c057',
      C: '#fd7e14',
      D: '#be4bdb',
      E: '#1098ad',
    };

    // Aggregate by zone: count total racks and occupied racks (racks with any stock)
    const zone_map: Record<
      string,
      { total_racks: number; occupied_racks: number; count: number }
    > = {};
    for (const g of gudangs) {
      const z = g.zone || 'UNKNOWN';
      if (!zone_map[z])
        zone_map[z] = { total_racks: 0, occupied_racks: 0, count: 0 };
      zone_map[z].total_racks++;
      zone_map[z].count++;
    }
    // Track which gudang IDs already counted as occupied (to avoid double-counting)
    const occupied_gudang_ids = new Set<number>();
    for (const s of stocks) {
      if (!s.gudang) continue;
      if (s.qty > 0 && !occupied_gudang_ids.has(s.gudang.id)) {
        occupied_gudang_ids.add(s.gudang.id);
        const z = s.gudang.zone || 'UNKNOWN';
        if (zone_map[z]) zone_map[z].occupied_racks++;
      }
    }

    const gauges = Object.entries(zone_map).map(([z, data]) => {
      const pct =
        data.total_racks > 0
          ? Math.min(
              100,
              Math.round((data.occupied_racks / data.total_racks) * 100),
            )
          : 0;
      const color = zone_color[z] || '#868e96';
      return {
        id: z,
        name: `Zone ${z}`,
        zone: z,
        total_racks: data.total_racks,
        occupied_racks: data.occupied_racks,
        pct,
        color,
      };
    });

    // Date range: default 1 year if not specified
    const start_date = from ? new Date(from) : new Date();
    start_date.setFullYear(start_date.getFullYear() - 1);
    const end_date = to ? new Date(to) : new Date();

    // Daily data for the selected range
    const daily_data: Record<string, number> = {};
    for (
      let d = new Date(start_date);
      d <= end_date;
      d.setDate(d.getDate() + 1)
    ) {
      const key = d.toISOString().split('T')[0];
      daily_data[key] = 0;
    }

    const logs = await this.log_repo.find({
      where: {
        created_at: Between(start_date, end_date),
        type: In([LogType.INBOUND, LogType.OUTBOUND]),
      },
      relations: ['gudang'],
      order: { created_at: 'ASC' },
    });

    const zone_daily: Record<string, Record<string, number>> = {};
    for (const log of logs) {
      const z = log.gudang?.zone || 'UNKNOWN';
      const date_key = log.created_at.toISOString().split('T')[0];
      if (!zone_daily[z]) zone_daily[z] = {};
      if (!zone_daily[z][date_key]) zone_daily[z][date_key] = 0;
      zone_daily[z][date_key] += log.qty;
    }

    // If zone is selected, return daily data for that zone
    if (zone) {
      const zone_data = zone_daily[zone] || {};
      const daily_series = Object.entries(daily_data).map(([date]) => ({
        date,
        value: zone_data[date] || 0,
      }));

      // Get items in this zone
      const zone_gudangs = gudangs.filter((g) => g.zone === zone);
      const zone_gudang_ids = zone_gudangs.map((g) => g.id);
      const items = stocks
        .filter((s) => s.gudang && zone_gudang_ids.includes(s.gudang.id))
        .map((s) => ({
          id: s.id,
          barang: s.barang?.nama || '-',
          batch: s.batch_no || '-',
          qty: s.qty,
          satuan: s.satuan || '-',
          expiry: s.expiry_date?.toISOString().split('T')[0] || '-',
          rack: s.gudang?.name || '-',
          zone: s.gudang?.zone || '-',
        }));

      return {
        gauges,
        selectedZone: zone,
        daily_series,
        items,
        range: {
          from: start_date.toISOString().split('T')[0],
          to: end_date.toISOString().split('T')[0],
        },
      };
    }

    // Default: weekly summary for all zones
    const weeks: string[] = [];
    for (let i = 51; i >= 0; i--) {
      const d = new Date(end_date);
      d.setDate(d.getDate() - i * 7);
      const mon = new Date(d);
      mon.setDate(mon.getDate() - mon.getDay() + 1);
      weeks.push(mon.toISOString().split('T')[0]);
    }

    const zone_groups: Record<
      string,
      { label: string; color: string; data: number[] }
    > = {};

    for (let w = 0; w < weeks.length; w++) {
      const week_end = new Date(weeks[w]);
      week_end.setDate(week_end.getDate() + 6);
      const zone_qty: Record<string, number> = {};
      for (const log of logs) {
        const log_date = new Date(log.created_at);
        if (log_date >= new Date(weeks[w]) && log_date <= week_end) {
          const z = log.gudang?.zone || 'UNKNOWN';
          zone_qty[z] = (zone_qty[z] || 0) + log.qty;
        }
      }
      for (const [z, qty] of Object.entries(zone_qty)) {
        if (!zone_groups[z]) {
          zone_groups[z] = {
            label: `Zone ${z}`,
            color: zone_color[z] || '#868e96',
            data: new Array(weeks.length).fill(0),
          };
        }
        zone_groups[z].data[w] = Math.round(qty);
      }
    }

    return {
      gauges,
      weeks: weeks.map((w, i) => ({ key: w, label: `W${i + 1}` })),
      series: Object.values(zone_groups),
      range: {
        from: start_date.toISOString().split('T')[0],
        to: end_date.toISOString().split('T')[0],
      },
    };
  }

  // OFTI data: inbound planning vs actual (on-time vs late)
  async get_ofti_data(from?: string, to?: string) {
    const start = from
      ? new Date(from)
      : (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 1);
          return d;
        })();
    const end = to ? new Date(to + 'T23:59:59') : new Date();

    const plans = await this.inbound_planning_repo.find({
      where: { estimasi_datang: Between(start, end) },
      order: { estimasi_datang: 'ASC' },
    });

    const day_names = ['M', 'Se', 'R', 'K', 'J', 'Sb', 'M'];
    const daily: Record<
      string,
      { ontime: number; late: number; label: string }
    > = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      daily[key] = { ontime: 0, late: 0, label: day_names[d.getDay()] };
    }

    const weekly: Record<
      string,
      { ontime: number; late: number; planned: number; label: string }
    > = {};

    for (const p of plans) {
      if (!p.estimasi_datang) continue;

      // Get week key from estimasi_datang (planned date)
      const tmp = new Date(p.estimasi_datang);
      tmp.setHours(0, 0, 0, 0);
      tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
      const year_start = new Date(tmp.getFullYear(), 0, 1);
      const week_no = Math.ceil(
        ((tmp.getTime() - year_start.getTime()) / 86400000 + 1) / 7,
      );
      const w_key = `W${String(week_no).padStart(2, '0')}`;
      if (!weekly[w_key])
        weekly[w_key] = { ontime: 0, late: 0, planned: 0, label: w_key };

      // Count as planned
      weekly[w_key].planned += 1;

      // If DONE with realisasi, check if ontime or late
      if (p.status === 'DONE' || p.tanggal_realisasi) {
        const plan_date = new Date(p.estimasi_datang);
        const key = plan_date.toISOString().split('T')[0];
        // tepat waktu = selisih_menit <= 0 (atau jika tidak ada selisih_menit, anggap tepat waktu jika status DONE)
        const is_on_time = p.selisih_menit === null || p.selisih_menit === undefined || p.selisih_menit <= 0;
        if (daily[key]) {
          if (is_on_time) daily[key].ontime += 1;
          else daily[key].late += 1;
        }
        if (is_on_time) weekly[w_key].ontime += 1;
        else weekly[w_key].late += 1;
      }
    }

    const daily_array = Object.entries(daily)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const weekly_array = Object.entries(weekly)
      .map(([week, v]) => ({ week, ...v }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // OTIF weekly percentages and table
    const otif_series = weekly_array.map((w) => {
      const total = w.ontime + w.late;
      const otif = total > 0 ? Math.round((w.ontime / total) * 100) : 0;
      const not_otif = total > 0 ? 100 - otif : 0;
      return { week: w.week, ontime: w.ontime, late: w.late, planned: w.planned, otif, not_otif };
    });

    // Table: planned vs actual per week
    const table = weekly_array.map((w) => ({
      week: w.week,
      planned: w.planned,
      actual: w.ontime + w.late,
      ontime: w.ontime,
      late: w.late,
    }));

    return { daily: daily_array, weekly: otif_series, table };
  }

  // Serapan Ayam data: planned vs actual outbound ayam (weekly for 1 year)
  async get_serapan_ayam_data(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date();
    if (!from) start.setFullYear(start.getFullYear() - 1);
    const end = to ? new Date(to + 'T23:59:59') : new Date();

    const plans = await this.planning_ayam_repo.find({
      where: { tanggal_planning: Between(start, end) },
      relations: ['barang'],
    });
    const outbounds = await this.outbound_ayam_repo.find({
      where: { created_at: Between(start, end) },
      relations: ['planning_ayam', 'planning_ayam.barang'],
    });

    const get_week_key = (d: Date) => {
      const tmp = new Date(d);
      tmp.setHours(0, 0, 0, 0);
      tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
      const year_start = new Date(tmp.getFullYear(), 0, 1);
      const week_no = Math.ceil(
        ((tmp.getTime() - year_start.getTime()) / 86400000 + 1) / 7,
      );
      return `W${String(week_no).padStart(2, '0')}`;
    };

    const weekly_map: Record<
      string,
      { week: string; planning: number; serapan: number }
    > = {};

    for (const p of plans) {
      if (!p.tanggal_planning) continue;
      const key = get_week_key(new Date(p.tanggal_planning));
      if (!weekly_map[key])
        weekly_map[key] = { week: key, planning: 0, serapan: 0 };
      weekly_map[key].planning += Number(p.qty || 0);
    }

    for (const o of outbounds) {
      if (!o.created_at) continue;
      const key = get_week_key(new Date(o.created_at));
      if (!weekly_map[key])
        weekly_map[key] = { week: key, planning: 0, serapan: 0 };
      weekly_map[key].serapan += Number(o.qty_aktual || 0);
    }

    const data = Object.values(weekly_map)
      .sort((a, b) => a.week.localeCompare(b.week))
      .map((w) => ({
        ...w,
        serapan_persen:
          w.planning > 0
            ? Math.round((w.serapan / w.planning) * 100)
            : 0,
      }));

    return { data };
  }

  // Inventory matrix data (daily in/out/balance per item)
  async get_inventory_matrix(side: boolean, from?: string, to?: string) {
    const barangs = await this.barang_repo.find({ where: { side } });
    const result: any[] = [];

    for (const brg of barangs) {
      const stocks = await this.stock_repo.find({
        where: { barang: { id: brg.id } },
        relations: ['gudang'],
      });
      const total_qty = stocks.reduce((s, st) => s + st.qty, 0);

      // Get daily logs
      const log_where: any = { barang: { id: brg.id } };
      if (from && to)
        log_where.created_at = Between(
          new Date(from),
          new Date(to + 'T23:59:59'),
        );

      const logs = await this.log_repo.find({
        where: log_where,
        relations: ['shift'],
        order: { created_at: 'ASC' },
      });

      // Group by date then shift. Shift 1, 2, 3
      const daily: Record<
        string,
        Record<string, { in: number; out: number }>
      > = {};
      for (const log of logs) {
        const dt = log.created_at.toISOString().split('T')[0];
        let sh = '1';
        if (log.shift?.name?.includes('2')) sh = '2';
        else if (log.shift?.name?.includes('3')) sh = '3';

        if (!daily[dt]) {
          daily[dt] = {
            '1': { in: 0, out: 0 },
            '2': { in: 0, out: 0 },
            '3': { in: 0, out: 0 },
          };
        }

        if (log.type === LogType.INBOUND) daily[dt][sh].in += log.qty;
        if (log.type === LogType.OUTBOUND) daily[dt][sh].out += log.qty;
      }

      result.push({
        id: brg.id,
        nama: brg.nama,
        sku: brg.sku,
        satuan: brg.satuan,
        saldoAwal: brg.stok,
        total_qty,
        daily,
        stocks,
      });
    }
    return result;
  }

  // Stock opname summary for a zone
  async get_opname_summary(zone?: string) {
    const where: any = {};
    if (zone) where.zone = zone;

    const gudangs = await this.gudang_repo.find({ where });
    const result: any[] = [];

    for (const g of gudangs) {
      const stocks = await this.stock_repo.find({
        where: { gudang: { id: g.id } },
        relations: ['barang'],
      });

      // Check if opnamed today
      const today = new Date().toISOString().split('T')[0];
      const opname_log = await this.log_repo.findOne({
        where: {
          gudang: { id: g.id },
          type: LogType.OPNAME,
          created_at: Between(new Date(today), new Date(today + 'T23:59:59')),
        },
      });

      result.push({
        gudang: g,
        stocks,
        total_qty: stocks.reduce((s, st) => s + st.qty, 0),
        totalReservedQty: stocks.reduce(
          (s, st) => s + (st.reserved_qty || 0),
          0,
        ),
        filled: stocks.some((st) => st.qty > 0),
        opnamed: !!opname_log,
      });
    }
    return result;
  }

  // Stock opname export data (for Excel/PDF) - accuracy is UNIVERSAL per barang across all racks
  async get_opname_export_data(zone?: string, from?: string, to?: string) {
    const where_gudang: any = {};
    if (zone && zone !== 'ALL') where_gudang.zone = zone;

    const gudangs = await this.gudang_repo.find({ where: where_gudang });
    const today = new Date();

    // Step 1: Collect all stock keyed by barang_id to compute universal accuracy
    // Universal accuracy = total qty opname (seluruh rak barang A) vs total qty sistem (seluruh rak barang A)
    const barang_acc_map: Record<
      number,
      { total_sistem: number; total_opname: number; shift?: string }
    > = {};

    // Kumpulkan semua stok yang relevan
    const all_stocks_in_zone = await this.stock_repo.find({
      where: gudangs.map((g) => ({ gudang: { id: g.id } })),
      relations: ['barang', 'gudang'],
    });

    // Get opname logs per gudang (latest per gudang)
    const opname_logs_per_gudang: Record<
      number,
      { qty: number; shift?: string; created_at?: Date; username?: string }
    > = {};
    for (const g of gudangs) {
      const log_where: any = { gudang: { id: g.id }, type: LogType.OPNAME };
      if (from && to) {
        log_where.created_at = Between(
          new Date(from),
          new Date(to + 'T23:59:59'),
        );
      }
      const opname_logs = await this.log_repo.find({
        where: log_where,
        relations: ['shift', 'user'],
        order: { created_at: 'DESC' },
        take: 1,
      });
      if (opname_logs[0]) {
        opname_logs_per_gudang[g.id] = {
          qty: opname_logs[0].qty,
          shift: opname_logs[0].shift?.name,
          created_at: opname_logs[0].created_at,
          username: opname_logs[0].user?.username,
        };
      }
    }

    // Aggregate per barang_id across all racks for universal accuracy
    for (const stock of all_stocks_in_zone) {
      if (!stock.barang) continue;
      const bid = stock.barang.id;
      if (!barang_acc_map[bid])
        barang_acc_map[bid] = { total_sistem: 0, total_opname: 0 };
      barang_acc_map[bid].total_sistem += stock.qty;
      const op_log = opname_logs_per_gudang[stock.gudang?.id];
      if (op_log) {
        barang_acc_map[bid].total_opname += op_log.qty;
        if (!barang_acc_map[bid].shift) barang_acc_map[bid].shift = op_log.shift;
      }
    }

    const result: any[] = [];

    for (const g of gudangs) {
      const stocks = await this.stock_repo.find({
        where: { gudang: { id: g.id } },
        relations: ['barang'],
      });

      if (!stocks.length) continue;

      const opname_log = opname_logs_per_gudang[g.id];

      for (const stock of stocks) {
        const expiry = stock.expiry_date;
        let days_to_exp: number | null = null;
        let days_in_storage: number | null = null;

        // Aging: lama simpan dari saat stok masuk
        if (stock.created_at) {
          days_in_storage = Math.floor(
            (today.getTime() - new Date(stock.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }

        if (expiry) {
          days_to_exp = Math.floor(
            (new Date(expiry).getTime() - today.getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }

        const stock_opname = opname_log?.qty ?? null;
        const stock_akhir = stock.qty;
        const variance = stock_opname !== null ? stock_opname - stock_akhir : null;
        const abs_variance = variance !== null ? Math.abs(variance) : null;
        const variance_pct =
          stock_akhir > 0 && variance !== null
            ? ((Math.abs(variance) / stock_akhir) * 100).toFixed(2)
            : null;

        // === UNIVERSAL ACCURACY: berdasarkan total seluruh rak per barang ===
        const bid = stock.barang?.id;
        let accuracy_pct = '100';
        if (bid && barang_acc_map[bid]) {
          const { total_sistem, total_opname } = barang_acc_map[bid];
          if (total_sistem > 0 && total_opname > 0) {
            accuracy_pct = (
              (Math.min(total_opname, total_sistem) /
                Math.max(total_opname, total_sistem)) *
              100
            ).toFixed(2);
          }
        }

        // === AGING STATUS ===
        let aging_status = 'NORMAL';

        // Prioritas 1: berdasarkan lama simpan (>90 hari = AGING)
        if (days_in_storage !== null && days_in_storage > 90) {
          aging_status = 'AGING';
        }

        // Prioritas 2: override jika expiry date lebih darurat
        if (days_to_exp !== null) {
          if (days_to_exp < 0) aging_status = 'EXPIRED';
          else if (days_to_exp < 30) aging_status = 'NEAR EXPIRED';
        }

        let notes = '';
        let note_color = '#000000';

        if (aging_status === 'AGING' && days_in_storage !== null) {
          if (days_in_storage >= 120)
            note_color = '#ef4444'; // Merah
          else if (days_in_storage >= 90)
            note_color = '#f97316'; // Orange
          else note_color = '#eab308'; // Kuning
          notes = `AGING (${days_in_storage} hari simpan)`;
        } else if (aging_status === 'EXPIRED') {
          note_color = '#ef4444';
          notes = `EXPIRED: ${days_to_exp !== null ? Math.abs(days_to_exp) + ' hari lalu' : ''}`;
        } else if (aging_status === 'NEAR EXPIRED') {
          note_color = '#f97316';
          notes = `NEAR EXPIRED: ${days_to_exp} hari tersisa`;
        }

        result.push({
          nomor_rak: g.name,
          item_code: stock.barang?.sku,
          item_name: stock.barang?.nama,
          category: stock.barang?.kategori,
          uom: stock.satuan || stock.barang?.satuan,
          location: g.zone,
          batch_lot: stock.batch_no,
          expiry_date: expiry
            ? new Date(expiry).toISOString().split('T')[0]
            : null,
          stock_akhir: stock_akhir,
          reserved_qty: stock.reserved_qty || 0,
          available_qty: stock.qty - (stock.reserved_qty || 0),
          stock_opname: stock_opname,
          variance_phys_book: variance,
          abs_variance: abs_variance,
          variance_pct: variance_pct,
          accuracy_pct: accuracy_pct,
          aging_status: aging_status,
          days_to_exp: days_to_exp,
          days_in_storage: days_in_storage,
          tolerance_ok: abs_variance !== null ? abs_variance <= 5 : true,
          notes: notes,
          note_color: note_color,
          shift: opname_log?.shift || null,
          created_at: opname_log?.created_at || stock.created_at || null,
          executed_by_username: opname_log?.username || null,
        });
      }
    }
    return result;
  }
}
