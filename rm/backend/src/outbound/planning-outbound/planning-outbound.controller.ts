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
  ParseIntPipe,
} from '@nestjs/common';
import { PlanningOutboundService } from './planning-outbound.service';
import {
  CreatePlanningOutboundDto,
  UpdatePlanningOutboundDto,
  ProcessPlanningOutboundDto,
  PublishPlanningOutboundDto,
} from './planning-outbound.dto';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';
import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';

@Controller('planning-outbound')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlanningOutboundController {
  constructor(private readonly svc: PlanningOutboundService) {}

  @Get()
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.CHECKER,
    UserRole.ADMIN,
  )
  find_all() {
    return this.svc.find_all();
  }

  @Get('filter')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.CHECKER,
    UserRole.ADMIN,
  )
  find_with_filter(
    @Query('status') status?: string,
    @Query('dateFrom') date_from?: string,
    @Query('dateTo') date_to?: string,
  ) {
    return this.svc.find_with_filter({ status, date_from, date_to });
  }

  @Get(':id')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.CHECKER,
    UserRole.ADMIN,
  )
  find_one(@Param('id', ParseIntPipe) id: number) {
    return this.svc.find_one(id);
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreatePlanningOutboundDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanningOutboundDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }

  @Post(':id/process')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  process_outbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessPlanningOutboundDto,
  ) {
    return this.svc.process_outbound(id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  publish_outbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishPlanningOutboundDto,
  ) {
    return this.svc.publish_outbound(id, dto);
  }
}
