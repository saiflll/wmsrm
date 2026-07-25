import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { OutboundAyam } from './outbound-ayam.entity';
import {
  CreateOutboundAyamDto,
  UpdateOutboundAyamDto,
  ProcessOutboundAyamDto,
  PublishOutboundAyamDto,
} from './outbound-ayam.dto';
import { PlanningAyam } from '../planning-ayam/planning-ayam.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { Stock } from '../../management/inventory/stock.entity';
import { StockLog, LogType } from '../../management/inventory/stock-log.entity';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';

@Injectable()
export class OutboundAyamService {
  constructor(
    @InjectRepository(OutboundAyam) private repo: Repository<OutboundAyam>,
    @InjectRepository(PlanningAyam)
    private planningRepo: Repository<PlanningAyam>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(StockLog) private logRepo: Repository<StockLog>,
    @InjectRepository(Barang) private barangRepo: Repository<Barang>,
    @InjectRepository(Gudang) private gudangRepo: Repository<Gudang>,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    return this.repo.find({
      where: { deleted_at: IsNull() },
      relations: ['planning_ayam', 'planning_ayam.barang', 'shift'],
      order: { created_at: 'DESC' },
    });
  }

  async findWithFilter(filter: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const qb = this.repo
      .createQueryBuilder('outbound')
      .leftJoinAndSelect('outbound.planning_ayam', 'planning')
      .leftJoinAndSelect('planning.barang', 'barang')
      .leftJoinAndSelect('outbound.shift', 'shift');

    if (filter.status) {
      qb.andWhere('planning.status = :status', { status: filter.status });
    }
    if (filter.dateFrom) {
      qb.andWhere('outbound.created_at >= :dateFrom', {
        dateFrom: new Date(filter.dateFrom),
      });
    }
    if (filter.dateTo) {
      qb.andWhere('outbound.created_at <= :dateTo', {
        dateTo: new Date(filter.dateTo),
      });
    }

    qb.orderBy('outbound.created_at', 'DESC');

    return qb.getMany();
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Outbound ayam tidak ditemukan');
    return item;
  }

  async create(dto: CreateOutboundAyamDto) {
    const planning = await this.planningRepo.findOne({
      where: { id: dto.planning_ayam_id },
      relations: ['barang'],
    });
    if (!planning) throw new NotFoundException('Planning ayam tidak ditemukan');
    if (planning.status === 'DONE')
      throw new BadRequestException('Planning ayam sudah selesai');

    const shift = dto.shift_id
      ? await this.shiftRepo.findOne({ where: { id: dto.shift_id } })
      : null;

    // FEFO: ambil stock dengan expiry_date paling awal (untuk batch_no)
    const stock = await this.stockRepo.findOne({
      where: { barang: { id: planning.barang.id } },
      order: { expiry_date: 'ASC', created_at: 'ASC' },
    });

    // VALIDASI STOCK TERSEDIA
    const allStocks = await this.stockRepo.find({
      where: { barang: { id: planning.barang.id } },
    });
    const totalAvailable = allStocks.reduce(
      (sum, s) => sum + (s.qty - s.reserved_qty),
      0,
    );
    if (totalAvailable < dto.qty_aktual) {
      throw new BadRequestException(
        `Stok tidak mencukupi. Tersedia: ${totalAvailable}, Diminta: ${dto.qty_aktual}`,
      );
    }

    // Create, process, and publish in one transaction
    return this.dataSource.transaction(async (manager) => {
      // Lock only the planning row (no relations to avoid FOR UPDATE + LEFT JOIN error)
      const txPlanning = await manager.findOne(PlanningAyam, {
        where: { id: planning.id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!txPlanning) throw new NotFoundException('Planning ayam tidak ditemukan');

      // Use barang from outside transaction (already fetched with relations)
      const barang = planning.barang;

      const item = manager.create(OutboundAyam, {
        planning_ayam: txPlanning,
        qty_aktual: dto.qty_aktual,
        satuan: dto.satuan || txPlanning.satuan,
        alokasi: dto.alokasi || [],
        tujuan: dto.tujuan,
        shift,
        keterangan: dto.keterangan,
        batch_no: stock?.batch_no || null,
      } as any);
      const saved = await manager.save(OutboundAyam, item);

      // Distribute deductions based on alokasi
      const alokasiItems = dto.alokasi || [];
      const distribution = alokasiItems.length > 0
        ? alokasiItems
        : [{ tujuan: 'Terserap', qty: dto.qty_aktual }];

      for (const alok of distribution) {
        // Reject: barang kembali — no stock movement, just record
        if (alok.tujuan === 'Reject') continue;

        let remaining = alok.qty;
        const stockRows = await manager.find(Stock, {
          where: { barang: { id: barang.id } },
          order: { expiry_date: 'ASC', created_at: 'ASC' },
          loadEagerRelations: false,
        });
        for (const st of stockRows) {
          if (remaining <= 0) break;
          const deduct = Math.min(st.qty, remaining);
          st.qty -= deduct;
          remaining -= deduct;
          await manager.save(Stock, st);

          const gudangId = (st as any).gudangId;
          const gudang = gudangId
            ? (await manager.findOneBy(Gudang, { id: gudangId })) ?? undefined
            : undefined;

          const log = manager.create(StockLog, {
            type: LogType.OUTBOUND,
            barang,
            gudang,
            qty: deduct,
            satuan: saved.satuan,
            batch_no: st.batch_no,
            expiry_date: st.expiry_date,
            tujuan: alok.tujuan,
            keterangan: dto.keterangan || `Outbound ayam: ${alok.tujuan}`,
          });
          await manager.save(StockLog, log);
        }
      }

      // Track processed quantity for partial processing
      txPlanning.processed_qty = (txPlanning.processed_qty || 0) + dto.qty_aktual;
      txPlanning.status = txPlanning.processed_qty >= txPlanning.qty ? 'DONE' : 'PROGRESS';
      await manager.save(PlanningAyam, txPlanning);

      // Mark outbound as published
      saved.published_at = new Date();
      await manager.save(OutboundAyam, saved);

      return saved;
    });
  }

  async update(id: number, dto: UpdateOutboundAyamDto) {
    const item = await this.findOne(id);

    if (item.published_at) {
      throw new BadRequestException(
        'Outbound yang sudah dipublish tidak bisa diubah',
      );
    }

    if (dto.planning_ayam_id !== undefined) {
      const planning = await this.planningRepo.findOne({
        where: { id: dto.planning_ayam_id },
      });
      if (!planning)
        throw new NotFoundException('Planning ayam tidak ditemukan');
      (item as any).planning_ayam = planning;
    }
    if (dto.shift_id !== undefined) {
      const shift = dto.shift_id
        ? await this.shiftRepo.findOneBy({ id: dto.shift_id })
        : null;
      (item as any).shift = shift;
    }
    if (dto.qty_aktual !== undefined) item.qty_aktual = dto.qty_aktual;
    if (dto.satuan !== undefined) item.satuan = dto.satuan;
    if (dto.alokasi !== undefined) item.alokasi = dto.alokasi;
    if (dto.tujuan !== undefined) item.tujuan = dto.tujuan;
    if (dto.keterangan !== undefined) item.keterangan = dto.keterangan;

    return this.repo.save(item);
  }

  async remove(id: number, userId?: number) {
    const item = await this.findOne(id);
    if (item.published_at) {
      throw new BadRequestException(
        'Outbound yang sudah dipublish tidak bisa dihapus. Gunakan void.',
      );
    }
    // revert planning status if it was DONE and reserve stock
    if (item.planning_ayam) {
      const planning = await this.planningRepo.findOne({
        where: { id: item.planning_ayam.id },
      });
      if (planning) {
        const stocks = await this.stockRepo.find({
          where: { barang: { id: planning.barang.id } }, // Cannot add deleted_at since stock has no deleted_at
        });
        let toRelease = item.qty_aktual;
        for (const stock of stocks) {
          if (toRelease <= 0) break;
          const releaseNow = Math.min(stock.reserved_qty, toRelease);
          stock.reserved_qty -= releaseNow;
          if (stock.reserved_qty < 0) stock.reserved_qty = 0;
          await this.stockRepo.save(stock);
          toRelease -= releaseNow;
        }
        planning.status = 'WAIT';
        await this.planningRepo.save(planning);
      }
    }
    await this.repo.update(id, {
      deleted_at: new Date(),
      deleted_by: userId || 0,
    });
    return { deleted: true };
  }

  async processOutbound(id: number, dto: ProcessOutboundAyamDto) {
    const outbound = await this.findOne(id);
    if (!outbound.planning_ayam) {
      throw new BadRequestException('Planning ayam tidak ditemukan');
    }

    const planning = await this.planningRepo.findOne({
      where: { id: outbound.planning_ayam.id },
    });
    if (!planning) {
      throw new NotFoundException('Planning ayam tidak ditemukan');
    }

    // Validate planning status is WAIT
    if (planning.status !== 'WAIT') {
      throw new BadRequestException(
        `Cannot process planning with status '${planning.status}'. Only 'WAIT' plans can be processed.`,
      );
    }

    // Save draft process data
    outbound.process_data = dto;

    // Update planning status to PROGRESS (draft state)
    planning.status = 'PROGRESS';
    await this.planningRepo.save(planning);

    return this.repo.save(outbound);
  }

  async publishOutbound(
    id: number,
    dto: PublishOutboundAyamDto,
  ): Promise<OutboundAyam> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Lock outbound row
      const outbound = await manager.findOne(OutboundAyam, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!outbound) {
        throw new NotFoundException(`Outbound ayam with ID ${id} not found`);
      }

      const fullOutbound = await manager.findOne(OutboundAyam, {
        where: { id },
        relations: ['planning_ayam', 'shift'],
      });
      if (fullOutbound) {
        outbound.planning_ayam = fullOutbound.planning_ayam;
        outbound.shift = fullOutbound.shift;
      }

      if (!outbound.process_data || !outbound.process_data.items) {
        throw new BadRequestException(
          'Outbound belum diproses. Lakukan process terlebih dahulu.',
        );
      }

      // 2. Validate planning status is PROGRESS
      const planning = await manager.findOne(PlanningAyam, {
        where: { id: outbound.planning_ayam.id },
      });
      if (!planning || planning.status !== 'PROGRESS') {
        throw new BadRequestException(
          `Planning status harus PROGRESS untuk publish. Status saat ini: ${planning?.status}`,
        );
      }

      // 3. Process items: deduct stock and create logs
      for (const item of outbound.process_data.items) {
        // Validate barang exists
        const barang = await manager.findOneBy(Barang, {
          id: item.barangId,
        });
        if (!barang) {
          throw new BadRequestException(`Barang ID ${item.barangId} not found`);
        }

        // Handle different tujuan categories
        if (
          item.tujuan === 'RETURN_TO_WH' ||
          item.tujuan === 'MISSING' ||
          item.tujuan === 'WASTE' ||
          item.tujuan === 'REJECT'
        ) {
          // These are loss/return categories, deduct from stock
          if (item.gudangId) {
            const gudang = await manager.findOneBy(Gudang, {
              id: item.gudangId,
            });
            if (!gudang) {
              throw new BadRequestException(
                `Gudang ID ${item.gudangId} not found`,
              );
            }

            // Find stock and deduct
            const stock = await manager.findOne(Stock, {
              where: {
                barang: { id: barang.id },
                gudang: { id: gudang.id },
                batch_no: item.batch_no || '',
              },
            });

            if (stock) {
              stock.qty -= item.qty;
              if (stock.qty < 0) stock.qty = 0;
              await manager.save(Stock, stock);
            }

            // Log the outbound/loss
            const log = manager.create(StockLog, {
              type: LogType.OUTBOUND,
              barang,
              gudang,
              qty: item.qty,
              satuan: stock?.satuan || barang.satuan,
              batch_no: item.batch_no,
              expiry_date: stock?.expiry_date,
              tujuan: item.tujuan,
              keterangan: dto.keterangan || `Outbound: ${item.tujuan}`,
            });
            await manager.save(StockLog, log);
          }
        } else {
          // Normal destination: deduct from current gudang
          if (outbound.planning_ayam) {
            // Use the gudang from outbound's stock source or param
            const sourceGudang = item.gudangId
              ? await manager.findOneBy(Gudang, { id: item.gudangId })
              : null;

            if (sourceGudang) {
              const stock = await manager.findOne(Stock, {
                where: {
                  barang: { id: barang.id },
                  gudang: { id: sourceGudang.id },
                  batch_no: item.batch_no || '',
                },
              });

              if (stock) {
                stock.qty -= item.qty;
                if (stock.qty < 0) stock.qty = 0;
                await manager.save(Stock, stock);
              }

              const log = manager.create(StockLog, {
                type: LogType.OUTBOUND,
                barang,
                gudang: sourceGudang,
                qty: item.qty,
                satuan: stock?.satuan || barang.satuan,
                batch_no: item.batch_no,
                expiry_date: stock?.expiry_date,
                tujuan: item.tujuan,
                keterangan: dto.keterangan,
              });
              await manager.save(StockLog, log);
            }
          }
        }
      }

      // 4. Track processed quantity, only DONE if fully processed
      const totalProcessed = outbound.process_data.items.reduce(
        (sum, item) => sum + item.qty, 0,
      );
      planning.processed_qty = (planning.processed_qty || 0) + totalProcessed;
      planning.status = planning.processed_qty >= planning.qty ? 'DONE' : 'PROGRESS';
      await manager.save(PlanningAyam, planning);

      // 5. Mark outbound as published
      outbound.published_at = new Date();
      await manager.save(OutboundAyam, outbound);

      return outbound;
    });
  }
}
