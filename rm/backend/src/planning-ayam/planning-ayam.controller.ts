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
} from '@nestjs/common';
import { PlanningAyamService } from './planning-ayam.service';
import {
  CreatePlanningAyamDto,
  UpdatePlanningAyamDto,
  UpdateStatusDto,
} from './planning-ayam.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('planning-ayam')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlanningAyamController {
  constructor(private readonly svc: PlanningAyamService) {}

  @Get()
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  findAll(@Query('status') status?: string) {
    if (status) return this.svc.findByStatus(status);
    return this.svc.findAll();
  }

  @Get('report')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  getReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getReport(from, to);
  }

  @Get(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  findOne(@Param('id') id: number) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreatePlanningAyamDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  update(@Param('id') id: number, @Body() dto: UpdatePlanningAyamDto) {
    return this.svc.update(id, dto);
  }

  @Put(':id/status')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  updateStatus(@Param('id') id: number, @Body() dto: UpdateStatusDto) {
    return this.svc.updateStatus(id, dto.status, dto.userId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: number) {
    return this.svc.remove(id);
  }
}
