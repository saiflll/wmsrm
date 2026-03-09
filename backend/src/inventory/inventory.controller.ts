import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InboundPostDto, OutboundPostDto, RelocationDto, OpnameDto } from './inventory.dto';
import { LogType } from './stock-log.entity';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
    constructor(private readonly svc: InventoryService) { }

    // ========== STOCK ==========
    @Get('stock')
    findAllStock(@Query('side') side?: string, @Query('search') search?: string) {
        const s = side === 'true' ? true : side === 'false' ? false : undefined;
        return this.svc.findAllStock(s, search);
    }

    @Get('stock/by-gudang')
    findStockByGudang(@Query('gudang_id') id: string) {
        return this.svc.findStockByGudang(+id);
    }

    @Get('stock/by-barang')
    findStockByBarang(@Query('barang_id') id: string) {
        return this.svc.findStockByBarang(+id);
    }

    // ========== INBOUND ==========
    @Post('inbound')
    postInbound(@Body() dto: InboundPostDto) {
        return this.svc.postInbound(dto.items);
    }

    // ========== OUTBOUND ==========
    @Post('outbound')
    postOutbound(@Body() dto: OutboundPostDto) {
        return this.svc.postOutbound(dto.items);
    }

    @Delete('outbound/:id')
    revertOutbound(@Param('id') id: string) {
        return this.svc.revertOutbound(id);
    }

    // ========== RELOCATION ==========
    @Post('relocation')
    relocate(@Body() dto: RelocationDto) {
        return this.svc.relocate(dto);
    }

    // ========== OPNAME ==========
    @Post('opname')
    opname(@Body() dto: OpnameDto) {
        return this.svc.opname(dto);
    }

    @Get('opname/summary')
    getOpnameSummary(@Query('zone') zone?: string) {
        return this.svc.getOpnameSummary(zone);
    }

    @Get('opname/export')
    getOpnameExport(@Query('zone') zone?: string) {
        return this.svc.getOpnameExportData(zone);
    }

    // ========== LOGS / REPORTS ==========
    @Get('logs')
    getLogs(
        @Query('type') type?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('shift_id') shift_id?: string,
        @Query('search') search?: string,
    ) {
        return this.svc.findLogs({
            type: type as LogType,
            from, to,
            shift_id: shift_id ? +shift_id : undefined,
            search,
        });
    }

    @Get('logs/inbound')
    getInboundLogs(@Query('from') from?: string, @Query('to') to?: string, @Query('shift_id') shift_id?: string) {
        return this.svc.findLogs({ type: LogType.INBOUND, from, to, shift_id: shift_id ? +shift_id : undefined });
    }

    @Get('logs/outbound')
    getOutboundLogs(@Query('from') from?: string, @Query('to') to?: string, @Query('shift_id') shift_id?: string) {
        return this.svc.findLogs({ type: LogType.OUTBOUND, from, to, shift_id: shift_id ? +shift_id : undefined });
    }

    @Get('logs/opname')
    getOpnameLogs(@Query('from') from?: string, @Query('to') to?: string, @Query('shift_id') shift_id?: string) {
        return this.svc.findLogs({ type: LogType.OPNAME, from, to, shift_id: shift_id ? +shift_id : undefined });
    }

    // ========== DASHBOARD ==========
    @Get('dashboard')
    getDashboard() {
        return this.svc.getDashboardStats();
    }

    // ========== INVENTORY MATRIX ==========
    @Get('matrix')
    getMatrix(@Query('side') side?: string, @Query('from') from?: string, @Query('to') to?: string) {
        const s = side !== 'false';
        return this.svc.getInventoryMatrix(s, from, to);
    }
}
