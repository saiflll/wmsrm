import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PlanningAyamService } from './planning-ayam.service';
import {
  CreatePlanningAyamDto,
  UpdatePlanningAyamDto,
  UpdateStatusDto,
} from './planning-ayam.dto';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';
import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';

@Controller('planning-ayam')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlanningAyamController {
  constructor(private readonly svc: PlanningAyamService) {}

  @Get()
  @Roles(
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.SUPERVISOR,
    UserRole.SUPER_ADMIN,
  )
  findAll(@Query('status') status?: string) {
    if (status) return this.svc.findByStatus(status);
    return this.svc.findAll();
  }

  @Get('report')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
  )
  getReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getReport(from, to);
  }

  @Get(':id')
  @Roles(
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.SUPERVISOR,
    UserRole.SUPER_ADMIN,
  )
  findOne(@Param('id') id: number) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.SUPERVISOR,
    UserRole.SUPER_ADMIN,
  )
  create(@Body() dto: CreatePlanningAyamDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @Roles(
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.SUPERVISOR,
    UserRole.SUPER_ADMIN,
  )
  update(@Param('id') id: number, @Body() dto: UpdatePlanningAyamDto) {
    return this.svc.update(id, dto);
  }

  @Put(':id/status')
  @Roles(
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.SUPERVISOR,
    UserRole.SUPER_ADMIN,
  )
  updateStatus(
    @Param('id') id: number,
    @Body() dto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.svc.updateStatus(id, dto.status, dto.userId || req.user?.id || 0);
  }

  @Delete(':id')
  @Roles(
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.KOORDINATOR,
    UserRole.SUPERVISOR,
    UserRole.SUPER_ADMIN,
  )
  remove(@Param('id') id: number, @Request() req: any) {
    return this.svc.remove(id, req.user?.id);
  }
}
