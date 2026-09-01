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
    private readonly relocation_service: RelocationService,
  ) {}

  @Get('sync-all')
  @Roles(UserRole.SUPERVISOR)
  sync_all() {
    return this.svc.sync_all_barang_stok();
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
  find_all_stock(
    @Query('side') side?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const s = side === 'true' ? true : side === 'false' ? false : undefined;
    const p = page ? Number(page) : 1;
    const l = limit ? Number(limit) : 50;
    return this.svc.find_all_stock(s, search, p, l);
  }

  @Get('export/stock')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  async export_stock(
    @Res() res: Response,
    @Query('gudang_id') gudang_id?: string,
  ) {
    const data = gudang_id
      ? await this.svc.find_stock_by_gudang(Number(gudang_id))
      : await this.svc.find_all_stock(undefined, undefined, 1, 10000); // 10k max limit for export

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
  async get_expired_alerts(@Query('gudang_id') gudang_id?: string) {
    return this.svc.get_expired_alerts(gudang_id ? Number(gudang_id) : undefined);
  }

  @Get('stock/by-gudang')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
  )
  find_stock_by_gudang(@Query('gudang_id') id: string) {
    return this.svc.find_stock_by_gudang(+id);
  }

  @Get('stock/by-barang')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
  )
  find_stock_by_barang(@Query('barang_id') id: string) {
    return this.svc.find_stock_by_barang(+id);
  }

  // ========== INBOUND ==========
  @Post('inbound')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  post_inbound(@Body() dto: InboundPostDto, @Request() req) {
    return this.svc.post_inbound(dto.items, req.user?.id, req.user?.username);
  }

  // ========== OUTBOUND ==========
  @Post('outbound')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  post_outbound(@Body() dto: OutboundPostDto, @Request() req) {
    return this.svc.post_outbound(dto.items, req.user?.id, req.user?.username);
  }

  @Delete('outbound/:id')
  @Roles(UserRole.SUPERVISOR)
  revert_outbound(@Param('id') id: string, @Request() req) {
    return this.svc.revert_outbound(id, req.user?.id);
  }

  // ========== PICKING ==========
  @Post('picking')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER, UserRole.KOORDINATOR)
  post_picking(@Body() dto: PickingPostDto, @Request() req) {
    return this.svc.post_picking(dto.items, req.user?.id);
  }

  @Post('outbound/confirm')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  confirm_picking(@Body() dto: ConfirmPickingDto, @Request() req) {
    return this.svc.confirm_picking(dto.no_ref, req.user?.id);
  }

  @Delete('picking/:id')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  cancel_picking(@Param('id') id: string, @Request() req) {
    return this.svc.cancel_picking(id, req.user?.id);
  }

  @Get('picking/pending')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER, UserRole.KOORDINATOR)
  get_pending_pickings() {
    return this.svc.get_pending_pickings();
  }

  // ========== RELOCATION ==========
  @Post('relocation')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  create_relocation(@Body() dto: CreateRelocationDto, @Request() req: any) {
    return this.relocation_service.create_relocation(dto, req.user?.username);
  }

  @Post('relocation/:id/execute')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  execute_relocation(@Param('id') id: string, @Request() req: any) {
    return this.relocation_service.execute_relocation(+id, req.user?.id, req.user?.username);
  }

  // ========== OPNAME ==========
  @Post('opname')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  opname(@Body() dto: OpnameDto, @Request() req) {
    return this.svc.opname(dto, req.user?.id);
  }

  @Get('opname/summary')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  get_opname_summary(@Query('zone') zone?: string) {
    return this.svc.get_opname_summary(zone);
  }

  @Get('opname/export')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  get_opname_export(
    @Query('zone') zone?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.get_opname_export_data(zone, from, to);
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
  get_logs(
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.find_logs({
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
  get_inbound_logs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.find_logs({
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
  get_outbound_logs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.find_logs({
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
  get_picking_logs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.find_logs({
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
  get_opname_logs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.find_logs({
      type: LogType.OPNAME,
      from,
      to,
      shift_id: shift_id ? +shift_id : undefined,
    });
  }

  @Get('logs/relocation')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  get_relocation_logs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift_id') shift_id?: string,
  ) {
    return this.svc.find_logs({
      type: LogType.RELOCATION,
      from,
      to,
      shift_id: shift_id ? +shift_id : undefined,
    });
  }

  // ========== DASHBOARD ==========
  @Get('dashboard')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  get_dashboard() {
    return this.svc.get_dashboard_stats();
  }

  @Get('dashboard/inout-chart')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  get_dashboard_in_out_chart() {
    return this.svc.get_in_out_chart_data();
  }

  @Get('dashboard/stock-chart')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  get_stock_chart(@Query('barang_id') barang_id?: string) {
    return this.svc.get_stock_chart_data(barang_id ? +barang_id : undefined);
  }

  @Get('dashboard/occupancy')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  get_dashboard_occupancy(
    @Query('zone') zone?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.get_occupancy_data(zone, from, to);
  }

  @Get('dashboard/ofti')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  get_dashboard_ofti(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.get_ofti_data(from, to);
  }

  @Get('dashboard/serapan-ayam')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  get_dashboard_serapan_ayam(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.get_serapan_ayam_data(from, to);
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
  get_matrix(
    @Query('side') side?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const s = side !== 'false';
    return this.svc.get_inventory_matrix(s, from, to);
  }
}
