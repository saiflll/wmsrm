import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RelocationService } from './relocation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import {
  InboundPostDto,
  OutboundPostDto,
  OpnameDto,
  PickingPostDto,
  ConfirmPickingDto,
} from './inventory.dto';
import { CreateRelocationDto } from './relocation.dto';
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
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
  )
  findAllStock(@Query('side') side?: string, @Query('search') search?: string) {
    const s = side === 'true' ? true : side === 'false' ? false : undefined;
    return this.svc.findAllStock(s, search);
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
  postInbound(@Body() dto: InboundPostDto) {
    return this.svc.postInbound(dto.items);
  }

  // ========== OUTBOUND ==========
  @Post('outbound')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  postOutbound(@Body() dto: OutboundPostDto) {
    return this.svc.postOutbound(dto.items);
  }

  @Delete('outbound/:id')
  @Roles(UserRole.SUPERVISOR)
  revertOutbound(@Param('id') id: string) {
    return this.svc.revertOutbound(id);
  }

  // ========== PICKING ==========
  @Post('picking')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER, UserRole.KOORDINATOR)
  postPicking(@Body() dto: PickingPostDto) {
    return this.svc.postPicking(dto.items);
  }

  @Post('outbound/confirm')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  confirmPicking(@Body() dto: ConfirmPickingDto) {
    return this.svc.confirmPicking(dto.no_ref);
  }

  @Delete('picking/:id')
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
  cancelPicking(@Param('id') id: string) {
    return this.svc.cancelPicking(id);
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
  opname(@Body() dto: OpnameDto) {
    return this.svc.opname(dto);
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
  @Roles(UserRole.SUPERVISOR)
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
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
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
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER)
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
  @Roles(UserRole.SUPERVISOR, UserRole.CHECKER, UserRole.KOORDINATOR)
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
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
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
    UserRole.SUPERVISOR,
    UserRole.CHECKER,
    UserRole.CHECKER,
    UserRole.KOORDINATOR,
    UserRole.MANAGER,
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
