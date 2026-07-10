import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanningAyam } from './planning-ayam.entity';
import { CreatePlanningAyamDto, UpdatePlanningAyamDto } from './planning-ayam.dto';
import { Barang } from '../barang/barang.entity';
import { Shift } from '../shifts/shift.entity';

@Injectable()
export class PlanningAyamService {
    constructor(
        @InjectRepository(PlanningAyam) private repo: Repository<PlanningAyam>,
        @InjectRepository(Barang) private barangRepo: Repository<Barang>,
        @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    ) { }

    async findAll() {
        return this.repo.find({ order: { created_at: 'DESC' } });
    }

    async findOne(id: number) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Planning ayam tidak ditemukan');
        return item;
    }

    async findByStatus(status: string) {
        return this.repo.find({ where: { status }, order: { tanggal_planning: 'ASC' } });
    }

    async create(dto: CreatePlanningAyamDto) {
        const barang = await this.barangRepo.findOneBy({ id: dto.barang_id });
        if (!barang) throw new NotFoundException('Barang tidak ditemukan');

        const shift = dto.shift_id ? await this.shiftRepo.findOneBy({ id: dto.shift_id }) : null;

        const item = this.repo.create({
            barang,
            qty: dto.qty,
            satuan: dto.satuan || barang.satuan,
            tanggal_planning: new Date(dto.tanggal_planning),
            shift,
            tujuan: dto.tujuan,
            status: dto.status || 'WAIT',
            keterangan: dto.keterangan,
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
            const shift = dto.shift_id ? await this.shiftRepo.findOneBy({ id: dto.shift_id }) : null;
            (item as any).shift = shift;
        }
        if (dto.qty !== undefined) item.qty = dto.qty;
        if (dto.satuan !== undefined) item.satuan = dto.satuan;
        if (dto.tanggal_planning !== undefined) item.tanggal_planning = new Date(dto.tanggal_planning);
        if (dto.tujuan !== undefined) item.tujuan = dto.tujuan;
        if (dto.status !== undefined) item.status = dto.status;
        if (dto.keterangan !== undefined) item.keterangan = dto.keterangan;

        return this.repo.save(item);
    }

    async remove(id: number) {
        const item = await this.findOne(id);
        return this.repo.remove(item);
    }

    async getReport(from?: string, to?: string) {
        const qb = this.repo.createQueryBuilder('p')
            .leftJoinAndSelect('p.barang', 'barang')
            .where('barang.nama ILIKE :ayam', { ayam: '%ayam%' });

        if (from) qb.andWhere('p.tanggal_planning >= :from', { from });
        if (to) qb.andWhere('p.tanggal_planning <= :to', { to });

        const plannings = await qb.getMany();

        const rows = plannings.map((p) => ({
            date: p.tanggal_planning?.toISOString().split('T')[0] || '-',
            planning: p.qty || 0,
            outbound: (p as any).qty_diterima || 0,
            status: p.status,
            barang: (p as any).barang?.nama || '-',
        }));

        return { rows };
    }
}
