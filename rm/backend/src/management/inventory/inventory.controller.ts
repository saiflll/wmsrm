import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InventoryService } from './inventory.service';
import { RelocationService } from '../relocation/relocation.service';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';
import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';
import {
  InboundPostDto,
  OutboundPostDto,
  OpnameDto,
  PickingPostDto,
  ConfirmPickingDto,
} from './inventory.dto';
import { CreateRelocationDto } from '../relocation/relocation.dto';
import { LogType } from './stock-log.entity';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly svc: InventoryService,
    private readonly relocationService: RelocationService,
  ) {}

  @Get('sync-all')
  @Roles(UserRole.SUPERVISOR)
  syncAll() {
    return this.svc.syncAllBarangStok();
  }

  // ========== STOCK ==========
  @Get('stock')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  findAllStock(
    @Query('side') side?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const s = side === 'true' ? true : side === 'false' ? false : undefined;
    const p = page ? Number(page) : 1;
    const l = limit ? Number(limit) : 50;
    return this.svc.findAllStock(s, search, p, l);
  }

  @Get('export/stock')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  async exportStock(
    @Res() res: Response,
    @Query('gudang_id') gudangId?: string,
  ) {
    const data = gudangId
      ? await this.svc.findStockByGudang(Number(gudangId))
      : await this.svc.findAllStock(undefined, undefined, 1, 10000); // 10k max limit for export

    // Simple CSV export
    const headers = [
      'Kode',
      'Nama Barang',
      'Batch',
      'Qty',
      'Satuan',
      'Gudang',
      'Expiry',
      'Reserved',
    ];
    const rows = (Array.isArray(data) ? data : data.data || []).map(
      (s: any) => [
        `"${s.barang?.sku || ''}"`,
        `"${s.barang?.nama || ''}"`,
        `"${s.batch_no || ''}"`,
        s.qty || 0,
        `"${s.satuan || ''}"`,
        `"${s.gudang?.name || ''}"`,
        s.expiry_date?.toISOString().split('T')[0] || '-',
        s.reserved_qty || 0,
      ],
    );

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=stock-export.csv',
    );
    res.send(csv);
  }

  @Get('expired-alerts')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.CHECKER)
  async getExpiredAlerts(@Query('gudang_id') gudangId?: string) {
    return this.svc.getExpiredAlerts(gudangId ? Number(gudangId) : undefined);
  }

  @Get('stock/by-gudang')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
  )
  findStockByGudang(@Query('gudang_id') id: string) {
    return this.svc.findStockByGudang(+id);
  }

  @Get('stock/by-barang')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
  )
  findStockByBarang(@Query('barang_id') id: string) {
    return this.svc.findStockByBarang(+id);
  }

  // ========== INBOUND ==========
  @Post('inbound')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  postInbound(@Body() dto: InboundPostDto, @Request() req) {
    return this.svc.postInbound(dto.items, req.user?.id);
  }

  // ========== OUTBOUND ==========
  @Post('outbound')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  postOutbound(@Body() dto: OutboundPostDto, @Request() req) {
    return this.svc.postOutbound(dto.items, req.user?.id);
  }

  @Delete('outbound/:id')
  @Roles(UserRole.SUPERVISOR)
  revertOutbound(@Param('id') id: string, @Request() req) {
    return this.svc.revertOutbound(id, req.user?.id);
  }

  // ========== PICKING ==========
  @Post('picking')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER, UserRole.KOORDINATOR)
  postPicking(@Body() dto: PickingPostDto, @Request() req) {
    return this.svc.postPicking(dto.items, req.user?.id);
  }

  @Post('outbound/confirm')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  confirmPicking(@Body() dto: ConfirmPickingDto, @Request() req) {
    return this.svc.confirmPicking(dto.no_ref, req.user?.id);
  }

  @Delete('picking/:id')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  cancelPicking(@Param('id') id: string, @Request() req) {
    return this.svc.cancelPicking(id, req.user?.id);
  }

  @Get('picking/pending')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER, UserRole.KOORDINATOR)
  getPendingPickings() {
    return this.svc.getPendingPickings();
  }

  // ========== RELOCATION ==========
  @Post('relocation')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  createRelocation(@Body() dto: CreateRelocationDto) {
    return this.relocationService.createRelocation(dto);
  }

  @Post('relocation/:id/execute')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  executeRelocation(@Param('id') id: string) {
    return this.relocationService.executeRelocation(+id);
  }

  // ========== OPNAME ==========
  @Post('opname')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  opname(@Body() dto: OpnameDto, @Request() req) {
    return this.svc.opname(dto, req.user?.id);
  }

  @Get('opname/summary')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  getOpnameSummary(@Query('zone') zone?: string) {
    return this.svc.getOpnameSummary(zone);
  }

  @Get('opname/export')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  getOpnameExport(
    @Query('zone') zone?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getOpnameExportData(zone, from, to);
  }

  // ========== LOGS / REPORTS ==========
  @Get('logs')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  getLogs(
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findLogs({
      type: type as LogType,
      from,
      to,
      shift_id: shift_id ? +shift_id : undefined,
      search,
    });
  }

  @Get('logs/inbound')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  getInboundLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.findLogs({
      type: LogType.INBOUND,
      from,
      to,
      shift_id: shift_id ? +shift_id : undefined,
    });
  }

  @Get('logs/outbound')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  getOutboundLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.findLogs({
      type: LogType.OUTBOUND,
      from,
      to,
      shift_id: shift_id ? +shift_id : undefined,
    });
  }

  @Get('logs/picking')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  getPickingLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.findLogs({
      type: LogType.PICKING,
      from,
      to,
      shift_id: shift_id ? +shift_id : undefined,
    });
  }

  @Get('logs/opname')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  getOpnameLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.findLogs({
      type: LogType.OPNAME,
      from,
      to,
      shift_id: shift_id ? +shift_id : undefined,
    });
  }

  // ========== DASHBOARD ==========
  @Get('dashboard')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
  )
  getDashboard() {
    return this.svc.getDashboardStats();
  }

  @Get('dashboard/inout-chart')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
  )
  getDashboardInOutChart() {
    return this.svc.getInOutChartData();
  }

  @Get('dashboard/stock-chart')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
  )
  getStockChart(@Query('barang_id') barangId?: string) {
    return this.svc.getStockChartData(barangId ? +barangId : undefined);
  }

  @Get('dashboard/occupancy')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
  )
  getDashboardOccupancy(
    @Query('zone') zone?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getOccupancyData(zone, from, to);
  }

  @Get('dashboard/ofti')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
  )
  getDashboardOFTI(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getOFTIData(from, to);
  }

  @Get('dashboard/serapan-ayam')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  getDashboardSerapanAyam(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getSerapanAyamData(from, to);
  }

  // ========== INVENTORY MATRIX ==========
  @Get('matrix')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
  )
  getMatrix(
    @Query('side') side?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const s = side !== 'false';
    return this.svc.getInventoryMatrix(s, from, to);
  }
}
