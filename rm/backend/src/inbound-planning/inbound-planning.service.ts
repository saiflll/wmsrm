import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboundPlanning } from './inbound-planning.entity';
import { CreateInboundPlanningDto, UpdateInboundPlanningDto } from './inbound-planning.dto';

@Injectable()
export class InboundPlanningService {
    constructor(
        @InjectRepository(InboundPlanning)
        private readonly repo: Repository<InboundPlanning>,
    ) { }

    async findAll() {
        const now = new Date();
        const plans = await this.repo.find({ order: { estimasi_datang: 'ASC', created_at: 'DESC' } });
        
        // Auto-fail late plans: if status is 'WAIT' and estimasi_datang is in the past
        for (const p of plans) {
            if (p.status === 'WAIT' && p.estimasi_datang && new Date(p.estimasi_datang) < now) {
                p.status = 'FAIL';
                await this.repo.update(p.id, { status: 'FAIL' });
            }
        }
        
        return plans;
    }

    async findOne(id: number) {
        const item = await this.repo.findOneBy({ id });
        if (!item) throw new NotFoundException(`Inbound planning with ID ${id} not found`);
        return item;
    }

    create(dto: CreateInboundPlanningDto) {
        const item = this.repo.create({
            ...dto,
            estimasi_datang: dto.estimasi_datang ? new Date(dto.estimasi_datang) : undefined,
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

    async remove(id: number) {
        const item = await this.findOne(id);
        await this.repo.remove(item);
        return { deleted: true };
    }
}
