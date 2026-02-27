import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { GudangService } from './gudang.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('gudang')
@UseGuards(JwtAuthGuard)
export class GudangController {
    constructor(private readonly svc: GudangService) { }

    @Get()
    findAll(@Query('side') side?: string, @Query('zone') zone?: string, @Query('search') search?: string) {
        const s = side === 'true' ? true : side === 'false' ? false : undefined;
        return this.svc.findAll(s, zone, search);
    }

    @Get('zones')
    getZones() {
        return this.svc.getZonesSummary();
    }

    @Get('slot')
    findBySlot(@Query('name') name: string) {
        return this.svc.findBySlot(name);
    }

    @Get('zone/:zone')
    findByZone(@Param('zone') zone: string) {
        return this.svc.findByZone(zone);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.svc.findOne(+id);
    }

    @Post()
    create(@Body() data: any) {
        return this.svc.create(data);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: any) {
        return this.svc.update(+id, data);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.svc.remove(+id);
    }
}
