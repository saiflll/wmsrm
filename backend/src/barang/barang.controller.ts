import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Barang } from './barang.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBarangDto, UpdateBarangDto } from './barang.dto';

@Controller('barang')
@UseGuards(JwtAuthGuard)
export class BarangController {
    constructor(@InjectRepository(Barang) private readonly repo: Repository<Barang>) { }

    @Get()
    findAll(@Query('side') side?: string, @Query('search') search?: string, @Query('kategori') kategori?: string) {
        const where: any = {};
        if (side === 'true') where.side = true;
        if (side === 'false') where.side = false;
        if (kategori) where.kategori = kategori;
        if (search) where.nama = ILike(`%${search}%`);
        return this.repo.find({ where, order: { id: 'ASC' } });
    }

    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.repo.findOneBy({ id });
    }

    @Post()
    create(@Body() dto: CreateBarangDto) {
        // Auto-set side based on kategori
        const data: any = { ...dto };
        if (dto.kategori === 'Wet' || dto.kategori === 'Waste') data.side = false;
        else data.side = true;
        if (!dto.sku) data.sku = `BRG${String(Date.now()).slice(-6)}`;
        return this.repo.save(this.repo.create(data));
    }

    @Put(':id')
    async update(@Param('id') id: number, @Body() dto: UpdateBarangDto) {
        const data: any = { ...dto };
        if (dto.kategori === 'Wet' || dto.kategori === 'Waste') data.side = false;
        else if (dto.kategori) data.side = true;
        await this.repo.update(id, data);
        return this.repo.findOneBy({ id });
    }

    @Delete(':id')
    async remove(@Param('id') id: number) {
        await this.repo.delete(id);
        return { deleted: true };
    }
}
