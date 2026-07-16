import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OutboundAyam } from './outbound-ayam.entity';
import {
  CreateOutboundAyamDto,
  UpdateOutboundAyamDto,
  ProcessOutboundAyamDto,
  PublishOutboundAyamDto,
} from './outbound-ayam.dto';
import { PlanningAyam } from '../planning-ayam/planning-ayam.entity';
import { Shift } from '../shifts/shift.entity';
import { Stock } from '../inventory/stock.entity';
import { StockLog, LogType } from '../inventory/stock-log.entity';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';

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
    return this.repo.find({ order: { created_at: 'DESC' } });
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
      .where('barang.nama NOT ILIKE :ayam', { ayam: '%ayam%' });

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
      ? await this.shiftRepo.findOneBy({ id: dto.shift_id })
      : null;

    // FEFO: ambil stock dengan expiry_date paling awal, lalu created_at paling awal
    const stock = await this.stockRepo.findOne({
      where: { barang: { id: planning.barang.id } },
      order: { expiry_date: 'ASC', created_at: 'ASC' },
    });

    const item = this.repo.create({
      planning_ayam: planning,
      qty_aktual: dto.qty_aktual,
      satuan: dto.satuan || planning.satuan,
      alokasi: dto.alokasi || [],
      tujuan: dto.tujuan,
      shift,
      keterangan: dto.keterangan,
      batch_no: stock?.batch_no || null,
    } as any);

    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateOutboundAyamDto) {
    const item = await this.findOne(id);

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

  async remove(id: number) {
    const item = await this.findOne(id);
    // revert planning status if it was DONE
    if (item.planning_ayam) {
      const planning = await this.planningRepo.findOne({
        where: { id: item.planning_ayam.id },
      });
      if (planning) {
        planning.status = 'WAIT';
        await this.planningRepo.save(planning);
      }
    }
    return this.repo.remove(item);
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

      // 4. Update planning status to DONE
      planning.status = 'DONE';
      await manager.save(PlanningAyam, planning);

      // 5. Mark outbound as published
      outbound.published_at = new Date();
      await manager.save(OutboundAyam, outbound);

      return outbound;
    });
  }
}
