import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, ILike, In } from 'typeorm';
import { Stock } from './stock.entity';
import { StockLog, LogType } from './stock-log.entity';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';
import { Shift } from '../shifts/shift.entity';
import { InboundPlanning } from '../inbound-planning/inbound-planning.entity';
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
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(StockLog) private logRepo: Repository<StockLog>,
    @InjectRepository(Barang) private barangRepo: Repository<Barang>,
    @InjectRepository(Gudang) private gudangRepo: Repository<Gudang>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    private dataSource: DataSource,
  ) {}

  private async syncBarangStok(manager: any, barangId: number) {
    const result = await manager
      .getRepository(Stock)
      .createQueryBuilder('s')
      .where('s.barangId = :barangId', { barangId })
      .select('SUM(s.qty)', 'total')
      .getRawOne();
    const total = parseFloat(result?.total || '0');
    await manager.update(Barang, barangId, { stok: total });
  }

  async syncAllBarangStok() {
    return this.dataSource.transaction(async (manager) => {
      const barangs = await manager.find(Barang);
      for (const b of barangs) {
        await this.syncBarangStok(manager, b.id);
      }
      return { message: `Synced ${barangs.length} items` };
    });
  }

  // ========== INBOUND ==========
  async postInbound(items: InboundItemDto[], userId?: number) {
    return this.dataSource.transaction(async (manager) => {
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
        await this.syncBarangStok(manager, barang.id);

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
        } as any);
        await manager.save(StockLog, log);
        logs.push(log);

        // Check if there is an inbound planning with this PO
        const plan = await manager.findOne(InboundPlanning, {
          where: { no_po: item.no_po },
        });
        if (plan && plan.status !== 'DONE') {
          let arrivalDate = new Date();
          if (item.tanggal_income) {
            const base = item.tanggal_income;
            const time = item.jam_datang || '00:00';
            const parsed = new Date(`${base}T${time}`);
            if (!isNaN(parsed.getTime())) {
              arrivalDate = parsed;
            }
          }
          let selisih = 0;
          if (plan.estimasi_datang) {
            selisih = Math.round((arrivalDate.getTime() - new Date(plan.estimasi_datang).getTime()) / 60000);
          }
          plan.status = 'DONE';
          plan.tanggal_realisasi = arrivalDate;
          plan.selisih_menit = selisih;
          await manager.save(InboundPlanning, plan);
        }
      }
      return logs;
    });
  }

  // ========== OUTBOUND (Picking) ==========
  async postOutbound(items: OutboundItemDto[], userId?: number) {
    return this.dataSource.transaction(async (manager) => {
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

        const availableQty = stock.qty - stock.reserved_qty;
        if (availableQty < item.qty) {
          throw new BadRequestException(
            `Stok tersedia tidak cukup untuk ${barang.nama} di ${gudang.name} (Tersedia: ${availableQty}, Diminta: ${item.qty})`,
          );
        }

        // Deduct physical stock quantity
        stock.qty -= item.qty;
        await manager.save(Stock, stock);

        // Clean up empty stock
        if (stock.qty <= 0) {
          await manager.remove(Stock, stock);
        }

        await this.syncBarangStok(manager, barang.id);

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
        } as any);
        await manager.save(StockLog, log);
        logs.push(log);
      }
      return logs;
    });
  }

  // ========== PICKING PLAN ==========
  async postPicking(items: PickingItemDto[], userId?: number) {
    return this.dataSource.transaction(async (manager) => {
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

        const availableQty = stock.qty - stock.reserved_qty;
        if (availableQty < item.qty) {
          throw new BadRequestException(
            `Stok tersedia tidak cukup untuk ${barang.nama} di ${gudang.name} (Tersedia: ${availableQty}, Diminta: ${item.qty})`,
          );
        }

        // Increment reserved_qty
        stock.reserved_qty += item.qty;
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
          satuan: item.satuan || barang.satuan,
          tujuan: item.tujuan,
          shift: shift || undefined,
          batch_no: stock.batch_no,
          expiry_date: stock.expiry_date,
        } as any);
        await manager.save(StockLog, log);
        logs.push(log);
      }
      return logs;
    });
  }

  async confirmPicking(noRef: string, userId?: number) {
    return this.dataSource.transaction(async (manager) => {
      const logs = await manager.find(StockLog, {
        where: { no_ref: noRef, type: LogType.PICKING, status: 'RESERVED' },
        relations: ['barang', 'gudang'],
      });

      if (!logs.length) {
        throw new NotFoundException('Picking plan dengan status RESERVED tidak ditemukan');
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
          throw new BadRequestException(`Stok tidak ditemukan untuk ${log.barang.nama} di ${log.gudang.name}`);
        }

        if (stock.qty < log.qty) {
          throw new BadRequestException(`Stok fisik tidak cukup untuk ${log.barang.nama} di ${log.gudang.name}`);
        }

        // Deduct physical qty and reserved_qty
        stock.qty -= log.qty;
        stock.reserved_qty = Math.max(0, stock.reserved_qty - log.qty);

        if (stock.qty <= 0) {
          await manager.remove(Stock, stock);
        } else {
          await manager.save(Stock, stock);
        }

        await this.syncBarangStok(manager, log.barang.id);

        // Update log type and status to indicate checkout
        log.type = LogType.OUTBOUND;
        log.status = 'CONFIRMED';
        await manager.save(StockLog, log);
      }

      return { message: 'Picking plan confirmed and checked out successfully' };
    });
  }

  async cancelPicking(noRef: string, userId?: number) {
    return this.dataSource.transaction(async (manager) => {
      const logs = await manager.find(StockLog, {
        where: { no_ref: noRef, type: LogType.PICKING, status: 'RESERVED' },
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
          stock.reserved_qty = Math.max(0, stock.reserved_qty - log.qty);
          await manager.save(Stock, stock);
        }

        // Delete the log
        await manager.remove(StockLog, log);
      }

      return { message: 'Picking plan cancelled successfully' };
    });
  }

  async getPendingPickings() {
    const logs = await this.logRepo.find({
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
  async revertOutbound(noRef: string, userId?: number) {
    return this.dataSource.transaction(async (manager) => {
      const logs = await manager.find(StockLog, {
        where: { no_ref: noRef, type: LogType.OUTBOUND },
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
        await this.syncBarangStok(manager, log.barang.id);
      }
      return { message: 'Reverted successfully' };
    });
  }

  // ========== RELOCATION ==========
  async relocate(dto: RelocationDto, userId?: number) {
    return this.dataSource.transaction(async (manager) => {
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
      const sourceGudang = stock.gudang;

      // Increase destination
      let destStock = await manager.findOne(Stock, {
        where: {
          barang: { id: stock.barang.id },
          gudang: { id: tujuan.id },
          batch_no: stock.batch_no,
        },
      });
      if (destStock) {
        destStock.qty += dto.qty;
      } else {
        destStock = manager.create(Stock, {
          barang: stock.barang,
          gudang: tujuan,
          batch_no: stock.batch_no,
          lot_no: stock.lot_no,
          qty: dto.qty,
          satuan: stock.satuan,
          expiry_date: stock.expiry_date,
        });
      }
      await manager.save(Stock, destStock);

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
      } as any);
      await manager.save(StockLog, log);

      // Decrease source LAST
      if (stock.qty <= 0) {
        await manager.remove(Stock, stock);
      } else {
        await manager.save(Stock, stock);
      }

      await this.syncBarangStok(manager, stock.barang.id);

      return log;
    });
  }

  // ========== STOCK OPNAME ==========
  async opname(dto: OpnameDto, userId?: number) {
    if (!dto.shift_id) {
      throw new BadRequestException(
        'Shift wajib dipilih untuk melakukan opname.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const today = new Date().toISOString().split('T')[0];

      const stocks = await manager.find(Stock, {
        where: { gudang: { id: dto.gudang_id } },
        relations: ['barang', 'gudang'],
      });

      if (!stocks.length)
        throw new NotFoundException('Stock not found at this location');

      const totalOldQty = stocks.reduce((sum, s) => sum + s.qty, 0);
      const diff = dto.qty_opname - totalOldQty;

      // Reorder so that the target stock_id is processed last (absorbs the diff)
      const targetIndex = dto.stock_id
        ? stocks.findIndex((s) => s.id === dto.stock_id)
        : 0;
      const primaryStock = stocks.splice(
        targetIndex !== -1 ? targetIndex : 0,
        1,
      )[0];
      stocks.push(primaryStock); // primaryStock is now at the END of the array

      const existingLog = await manager.findOne(StockLog, {
        where: {
          gudang: { id: dto.gudang_id },
          type: LogType.OPNAME,
          shift: { id: dto.shift_id },
          created_at: Between(new Date(today), new Date(today + 'T23:59:59')),
        },
        relations: ['shift'],
      });

      if (existingLog) {
        // Allow re-opname (update) for coordinator and above
        // Update existing log instead of throwing error
        let remainingOpname = dto.qty_opname;
        for (let i = 0; i < stocks.length; i++) {
          const s = stocks[i];
          if (i === stocks.length - 1) {
            s.qty = remainingOpname;
          } else {
            const assign = Math.min(s.qty, remainingOpname);
            s.qty = assign;
            remainingOpname -= assign;
          }
          if (s.qty <= 0) {
            await manager.remove(Stock, s);
          } else {
            await manager.save(Stock, s);
          }
        }

        await this.syncBarangStok(manager, primaryStock.barang.id);

        existingLog.qty = dto.qty_opname;
        existingLog.note = `Opname Rak (Update): ${totalOldQty} → ${dto.qty_opname} (diff: ${diff > 0 ? '+' : ''}${diff})`;
        existingLog.created_at = new Date();
        await manager.save(StockLog, existingLog);

        return { stock: primaryStock, log: existingLog, diff, updated: true };
      }

      let remainingOpname = dto.qty_opname;

      // Distribute the new qty_opname across available stocks
      for (let i = 0; i < stocks.length; i++) {
        const s = stocks[i];
        if (i === stocks.length - 1) {
          s.qty = remainingOpname; // Last one takes whatever is left
        } else {
          const assign = Math.min(s.qty, remainingOpname);
          s.qty = assign;
          remainingOpname -= assign;
        }

        if (s.qty <= 0) {
          await manager.remove(Stock, s);
        } else {
          await manager.save(Stock, s);
        }
      }

      // Sync global stock
      await this.syncBarangStok(manager, primaryStock.barang.id);

      // Resolve shift if provided
      const shift = dto.shift_id
        ? await manager.findOneBy(Shift, { id: dto.shift_id })
        : null;

      const log = manager.create(StockLog, {
        type: LogType.OPNAME,
        barang: primaryStock.barang,
        gudang: primaryStock.gudang,
        qty: dto.qty_opname,
        satuan: primaryStock.satuan,
        shift: shift || undefined,
        note: `Opname Rak: ${totalOldQty} → ${dto.qty_opname} (diff: ${diff > 0 ? '+' : ''}${diff})`,
      } as any);
      await manager.save(StockLog, log);

      return { stock: primaryStock, log, diff };
    });
  }

  // ========== QUERIES ==========
  findAllStock(side?: boolean, search?: string) {
    const where: any = {};
    if (side !== undefined) where.barang = { side };
    return this.stockRepo.find({
      where,
      relations: ['barang', 'gudang'],
      order: { created_at: 'DESC' },
    });
  }

  findStockByGudang(gudangId: number) {
    return this.stockRepo.find({
      where: { gudang: { id: gudangId } },
      relations: ['barang', 'gudang'],
    });
  }

  findStockByBarang(barangId: number) {
    return this.stockRepo.find({
      where: { barang: { id: barangId } },
      relations: ['barang', 'gudang'],
    });
  }

  // Logs with filters
  findLogs(filters: {
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

    return this.logRepo.find({
      where,
      relations: ['barang', 'gudang', 'gudang_tujuan', 'shift', 'user'],
      order: { created_at: 'DESC' },
      take: 500,
    });
  }

  // Dashboard stats
  async getDashboardStats() {
    const totalSku = await this.barangRepo.count();
    const totalStock = await this.barangRepo
      .createQueryBuilder('b')
      .select('SUM(b.stok)', 'total')
      .getRawOne();

    const inboundCount = await this.logRepo.count({
      where: { type: LogType.INBOUND },
    });
    const outboundCount = await this.logRepo.count({
      where: { type: LogType.OUTBOUND },
    });

    const pickingPendingCountRaw = await this.logRepo
      .createQueryBuilder('l')
      .where('l.type = :type AND l.status = :status', { type: LogType.PICKING, status: 'RESERVED' })
      .select('COUNT(DISTINCT l.no_ref)', 'cnt')
      .getRawOne();
    const pickingPendingCount = Number(pickingPendingCountRaw?.cnt || 0);

    // Gudang utilization
    const totalSlots = await this.gudangRepo.count();
    const filledSlots = await this.stockRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.gudangId)', 'cnt')
      .getRawOne();

    // Expired alerts
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiredCountRaw = await this.stockRepo
      .createQueryBuilder('s')
      .where('s.expiry_date < :now', { now })
      .select('COUNT(s.id)', 'cnt')
      .getRawOne();
    const expiredCount = Number(expiredCountRaw?.cnt || 0);

    const nearExpiredCountRaw = await this.stockRepo
      .createQueryBuilder('s')
      .where('s.expiry_date >= :now AND s.expiry_date <= :thirtyDaysFromNow', { now, thirtyDaysFromNow })
      .select('COUNT(s.id)', 'cnt')
      .getRawOne();
    const nearExpiredCount = Number(nearExpiredCountRaw?.cnt || 0);

    // Waste count
    const wasteCountRaw = await this.stockRepo
      .createQueryBuilder('s')
      .leftJoin('s.gudang', 'g')
      .where('g.zone = :zone', { zone: 'WASTE' })
      .select('COUNT(s.id)', 'cnt')
      .getRawOne();
    const wasteCount = Number(wasteCountRaw?.cnt || 0);

    // Summary Waktu
    const parseTimeToMinutes = (t: string) => {
      if (!t) return null;
      const parts = t.split(':');
      if (parts.length < 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const inboundLogs = await this.logRepo.find({
      where: {
        type: LogType.INBOUND,
        created_at: Between(thirtyDaysAgo, new Date()),
      }
    });

    let totalWaitTime = 0;
    let totalUnloadTime = 0;
    let waitCount = 0;
    let unloadCount = 0;

    for (const log of inboundLogs) {
      const tDatang = parseTimeToMinutes(log.jam_datang);
      const tBongkar = parseTimeToMinutes(log.jam_bongkar);
      const tSelesai = parseTimeToMinutes(log.jam_selesai);

      if (tDatang !== null && tBongkar !== null && tBongkar >= tDatang) {
        totalWaitTime += (tBongkar - tDatang);
        waitCount++;
      }
      if (tBongkar !== null && tSelesai !== null && tSelesai >= tBongkar) {
        totalUnloadTime += (tSelesai - tBongkar);
        unloadCount++;
      }
    }

    const avgWaitingTime = waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0;
    const avgUnloadingTime = unloadCount > 0 ? Math.round(totalUnloadTime / unloadCount) : 0;

    // Inbound Driver Planning stats
    const planWaitCount = await this.stockRepo.manager.count(InboundPlanning, { where: { status: 'WAIT' } });
    const planFailCount = await this.stockRepo.manager.count(InboundPlanning, { where: { status: 'FAIL' } });
    const planDoneCount = await this.stockRepo.manager.count(InboundPlanning, { where: { status: 'DONE' } });

    const delayResult = await this.stockRepo.manager
      .getRepository(InboundPlanning)
      .createQueryBuilder('p')
      .where('p.status = :status AND p.selisih_menit IS NOT NULL', { status: 'DONE' })
      .select('AVG(p.selisih_menit)', 'avg')
      .getRawOne();
    const avgDelay = delayResult?.avg ? Math.round(parseFloat(delayResult.avg)) : 0;

    return {
      totalSku,
      totalStock: Number(totalStock?.total || 0),
      inboundCount,
      outboundCount,
      pickingPendingCount,
      totalSlots,
      filledSlots: Number(filledSlots?.cnt || 0),
      utilization:
        totalSlots > 0
          ? ((Number(filledSlots?.cnt || 0) / totalSlots) * 100).toFixed(1)
          : '0',
      expiredCount,
      nearExpiredCount,
      wasteCount,
      avgWaitingTime,
      avgUnloadingTime,
      planWaitCount,
      planFailCount,
      planDoneCount,
      avgDelay,
    };
  }

  async getInOutChartData() {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const logs = await this.logRepo.find({
      where: {
        created_at: Between(oneYearAgo, new Date()),
      },
      order: { created_at: 'ASC' },
    });

    const weeklyData: Record<string, { inbound: number; outbound: number }> = {};

    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(date.setDate(diff));
      return mon.toISOString().split('T')[0];
    };

    for (const log of logs) {
      if (log.type !== LogType.INBOUND && log.type !== LogType.OUTBOUND) continue;
      const monStr = getMonday(log.created_at);
      if (!weeklyData[monStr]) {
        weeklyData[monStr] = { inbound: 0, outbound: 0 };
      }
      if (log.type === LogType.INBOUND) {
        weeklyData[monStr].inbound += log.qty;
      } else if (log.type === LogType.OUTBOUND) {
        weeklyData[monStr].outbound += log.qty;
      }
    }

    const sortedWeeks = Object.keys(weeklyData).sort();
    return sortedWeeks.map((weekStr) => ({
      week: weekStr,
      inbound: Math.round(weeklyData[weekStr].inbound),
      outbound: Math.round(weeklyData[weekStr].outbound),
    }));
  }

  // Stock chart data - daily stock levels per product (last 30 days)
  async getStockChartData(barangId?: number) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();

    // Generate date range
    const dates: string[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Get all products
    const where: any = {};
    if (barangId) where.id = barangId;
    const barangs = await this.barangRepo.find({ where });

    // Get logs in date range (only INBOUND/OUTBOUND)
    const logs = await this.logRepo.find({
      where: {
        created_at: Between(thirtyDaysAgo, new Date(today.getTime() + 86400000)),
        type: In([LogType.INBOUND, LogType.OUTBOUND]),
        ...(barangId ? { barang: { id: barangId } } : {}),
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
      changes[bid][dt] = (changes[bid][dt] || 0) + (log.type === LogType.INBOUND ? log.qty : -log.qty);
    }

    // Get current stock per product
    const currentStocks: Record<number, number> = {};
    const stockRows = await this.stockRepo
      .createQueryBuilder('s')
      .select('s.barang_id', 'barang_id')
      .addSelect('SUM(s.qty)', 'qty')
      .groupBy('s.barang_id')
      .getRawMany();
    for (const row of stockRows) {
      currentStocks[row.barang_id] = parseFloat(row.qty) || 0;
    }

    // Build series: work backwards from current stock
    const series: any[] = [];
    for (const brg of barangs) {
      const curStock = currentStocks[brg.id] || 0;
      // Compute cumulative forward stock
      let running = 0;
      const dataPoints = dates.map((dt) => {
        const net = changes[brg.id]?.[dt] || 0;
        running += net;
        return { date: dt, net };
      });

      // Current stock = sum of all net changes up to today + starting stock
      // starting stock = curStock - total net change
      const totalNet = dataPoints.reduce((s, d) => s + d.net, 0);
      const startingStock = Math.max(0, curStock - totalNet);

      // Compute cumulative stock level
      let cum = startingStock;
      const stockData = dataPoints.map((d) => {
        cum += d.net;
        return { date: d.date, stock: Math.round(cum * 10) / 10 };
      });

      series.push({
        id: brg.id,
        nama: brg.nama,
        satuan: brg.satuan,
        color: brg.kategori === 'Wet' ? '#fcc419' : brg.kategori === 'Waste' ? '#845ef7' : '#1c7ed6',
        data: stockData,
      });
    }

    return { dates, series };
  }

  // Inventory matrix data (daily in/out/balance per item)
  async getInventoryMatrix(side: boolean, from?: string, to?: string) {
    const barangs = await this.barangRepo.find({ where: { side } });
    const result: any[] = [];

    for (const brg of barangs) {
      const stocks = await this.stockRepo.find({
        where: { barang: { id: brg.id } },
        relations: ['gudang'],
      });
      const totalQty = stocks.reduce((s, st) => s + st.qty, 0);

      // Get daily logs
      const logWhere: any = { barang: { id: brg.id } };
      if (from && to)
        logWhere.created_at = Between(
          new Date(from),
          new Date(to + 'T23:59:59'),
        );

      const logs = await this.logRepo.find({
        where: logWhere,
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
        totalQty,
        daily,
        stocks,
      });
    }
    return result;
  }

  // Stock opname summary for a zone
  async getOpnameSummary(zone?: string) {
    const where: any = {};
    if (zone) where.zone = zone;

    const gudangs = await this.gudangRepo.find({ where });
    const result: any[] = [];

    for (const g of gudangs) {
      const stocks = await this.stockRepo.find({
        where: { gudang: { id: g.id } },
        relations: ['barang'],
      });

      // Check if opnamed today
      const today = new Date().toISOString().split('T')[0];
      const opnameLog = await this.logRepo.findOne({
        where: {
          gudang: { id: g.id },
          type: LogType.OPNAME,
          created_at: Between(new Date(today), new Date(today + 'T23:59:59')),
        },
      });

      result.push({
        gudang: g,
        stocks,
        totalQty: stocks.reduce((s, st) => s + st.qty, 0),
        totalReservedQty: stocks.reduce((s, st) => s + (st.reserved_qty || 0), 0),
        filled: stocks.some((st) => st.qty > 0),
        opnamed: !!opnameLog,
      });
    }
    return result;
  }

  // Stock opname export data (for Excel/PDF) - accuracy is UNIVERSAL per barang across all racks
  async getOpnameExportData(zone?: string, from?: string, to?: string) {
    const whereGudang: any = {};
    if (zone) whereGudang.zone = zone;

    const gudangs = await this.gudangRepo.find({ where: whereGudang });
    const today = new Date();

    // Step 1: Collect all stock keyed by barang_id to compute universal accuracy
    // Universal accuracy = total qty opname (seluruh rak barang A) vs total qty sistem (seluruh rak barang A)
    const barangAccMap: Record<
      number,
      { totalSistem: number; totalOpname: number; shift?: string }
    > = {};

    // Kumpulkan semua stok yang relevan
    const allStocksInZone = await this.stockRepo.find({
      where: gudangs.map((g) => ({ gudang: { id: g.id } })),
      relations: ['barang', 'gudang'],
    });

    // Get opname logs per gudang (latest per gudang)
    const opnameLogsPerGudang: Record<number, { qty: number; shift?: string }> =
      {};
    for (const g of gudangs) {
      const logWhere: any = { gudang: { id: g.id }, type: LogType.OPNAME };
      if (from && to) {
        logWhere.created_at = Between(
          new Date(from),
          new Date(to + 'T23:59:59'),
        );
      }
      const opnameLogs = await this.logRepo.find({
        where: logWhere,
        relations: ['shift'],
        order: { created_at: 'DESC' },
        take: 1,
      });
      if (opnameLogs[0]) {
        opnameLogsPerGudang[g.id] = {
          qty: opnameLogs[0].qty,
          shift: opnameLogs[0].shift?.name,
        };
      }
    }

    // Aggregate per barang_id across all racks for universal accuracy
    for (const stock of allStocksInZone) {
      if (!stock.barang) continue;
      const bid = stock.barang.id;
      if (!barangAccMap[bid])
        barangAccMap[bid] = { totalSistem: 0, totalOpname: 0 };
      barangAccMap[bid].totalSistem += stock.qty;
      const opLog = opnameLogsPerGudang[stock.gudang?.id];
      if (opLog) {
        barangAccMap[bid].totalOpname += opLog.qty;
        if (!barangAccMap[bid].shift) barangAccMap[bid].shift = opLog.shift;
      }
    }

    const result: any[] = [];

    for (const g of gudangs) {
      const stocks = await this.stockRepo.find({
        where: { gudang: { id: g.id } },
        relations: ['barang'],
      });

      if (!stocks.length) continue;

      const opnameLog = opnameLogsPerGudang[g.id];

      for (const stock of stocks) {
        const expiry = stock.expiry_date;
        let daysToExp: number | null = null;
        let daysInStorage: number | null = null;

        // Aging: lama simpan dari saat stok masuk
        if (stock.created_at) {
          daysInStorage = Math.floor(
            (today.getTime() - new Date(stock.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }

        if (expiry) {
          daysToExp = Math.floor(
            (new Date(expiry).getTime() - today.getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }

        const stockOpname = opnameLog?.qty ?? null;
        const stockAkhir = stock.qty;
        const variance = stockOpname !== null ? stockOpname - stockAkhir : null;
        const absVariance = variance !== null ? Math.abs(variance) : null;
        const variancePct =
          stockAkhir > 0 && variance !== null
            ? ((Math.abs(variance) / stockAkhir) * 100).toFixed(2)
            : null;

        // === UNIVERSAL ACCURACY: berdasarkan total seluruh rak per barang ===
        const bid = stock.barang?.id;
        let accuracyPct = '100';
        if (bid && barangAccMap[bid]) {
          const { totalSistem, totalOpname } = barangAccMap[bid];
          if (totalSistem > 0 && totalOpname > 0) {
            accuracyPct = (
              (Math.min(totalOpname, totalSistem) /
                Math.max(totalOpname, totalSistem)) *
              100
            ).toFixed(2);
          }
        }

        // === AGING STATUS ===
        let agingStatus = 'NORMAL';

        // Prioritas 1: berdasarkan lama simpan (>90 hari = AGING)
        if (daysInStorage !== null && daysInStorage > 90) {
          agingStatus = 'AGING';
        }

        // Prioritas 2: override jika expiry date lebih darurat
        if (daysToExp !== null) {
          if (daysToExp < 0) agingStatus = 'EXPIRED';
          else if (daysToExp < 30) agingStatus = 'NEAR EXPIRED';
        }

        let notes = '';
        let noteColor = '#000000';

        if (agingStatus === 'AGING' && daysInStorage !== null) {
          if (daysInStorage >= 120)
            noteColor = '#ef4444'; // Merah
          else if (daysInStorage >= 90)
            noteColor = '#f97316'; // Orange
          else noteColor = '#eab308'; // Kuning
          notes = `AGING (${daysInStorage} hari simpan)`;
        } else if (agingStatus === 'EXPIRED') {
          noteColor = '#ef4444';
          notes = `EXPIRED: ${daysToExp !== null ? Math.abs(daysToExp) + ' hari lalu' : ''}`;
        } else if (agingStatus === 'NEAR EXPIRED') {
          noteColor = '#f97316';
          notes = `NEAR EXPIRED: ${daysToExp} hari tersisa`;
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
          stock_akhir: stockAkhir,
          reserved_qty: stock.reserved_qty || 0,
          available_qty: stock.qty - (stock.reserved_qty || 0),
          stock_opname: stockOpname,
          variance_phys_book: variance,
          abs_variance: absVariance,
          variance_pct: variancePct,
          accuracy_pct: accuracyPct,
          aging_status: agingStatus,
          days_to_exp: daysToExp,
          days_in_storage: daysInStorage,
          tolerance_ok: absVariance !== null ? absVariance <= 5 : true,
          notes: notes,
          note_color: noteColor,
          shift: opnameLog?.shift || null,
        });
      }
    }
    return result;
  }
}
