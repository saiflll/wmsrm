import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboundAyam } from './outbound-ayam.entity';
import { CreateOutboundAyamDto, UpdateOutboundAyamDto } from './outbound-ayam.dto';
import { PlanningAyam } from '../planning-ayam/planning-ayam.entity';
import { Shift } from '../shifts/shift.entity';

@Injectable()
export class OutboundAyamService {
    constructor(
        @InjectRepository(OutboundAyam) private repo: Repository<OutboundAyam>,
        @InjectRepository(PlanningAyam) private planningRepo: Repository<PlanningAyam>,
        @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    ) { }

    async findAll() {
        return this.repo.find({ order: { created_at: 'DESC' } });
    }

    async findOne(id: number) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Outbound ayam tidak ditemukan');
        return item;
    }

    async create(dto: CreateOutboundAyamDto) {
        const planning = await this.planningRepo.findOne({ where: { id: dto.planning_ayam_id } });
        if (!planning) throw new NotFoundException('Planning ayam tidak ditemukan');
        if (planning.status === 'DONE') throw new BadRequestException('Planning ayam sudah selesai');

        const shift = dto.shift_id ? await this.shiftRepo.findOneBy({ id: dto.shift_id }) : null;

        const item = this.repo.create({
            planning_ayam: planning,
            qty_aktual: dto.qty_aktual,
            satuan: dto.satuan || planning.satuan,
            alokasi: dto.alokasi || [],
            tujuan: dto.tujuan,
            shift,
            keterangan: dto.keterangan,
        } as any);

        const saved = await this.repo.save(item);

        // update planning status
        planning.status = 'DONE';
        await this.planningRepo.save(planning);

        return saved;
    }

    async update(id: number, dto: UpdateOutboundAyamDto) {
        const item = await this.findOne(id);

        if (dto.planning_ayam_id !== undefined) {
            const planning = await this.planningRepo.findOne({ where: { id: dto.planning_ayam_id } });
            if (!planning) throw new NotFoundException('Planning ayam tidak ditemukan');
            (item as any).planning_ayam = planning;
        }
        if (dto.shift_id !== undefined) {
            const shift = dto.shift_id ? await this.shiftRepo.findOneBy({ id: dto.shift_id }) : null;
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
            const planning = await this.planningRepo.findOne({ where: { id: item.planning_ayam.id } });
            if (planning) {
                planning.status = 'WAIT';
                await this.planningRepo.save(planning);
            }
        }
        return this.repo.remove(item);
    }
}
