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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

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
  )
  findAll() {
    return this.svc.findAll();
  }

  @Get('filter')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.CHECKER,
  )
  findWithFilter(
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.findWithFilter({ status, dateFrom, dateTo });
  }

  @Get(':id')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.CHECKER,
  )
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  create(@Body() dto: CreatePlanningOutboundDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanningOutboundDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }

  @Post(':id/process')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  processOutbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessPlanningOutboundDto,
  ) {
    return this.svc.processOutbound(id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  publishOutbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishPlanningOutboundDto,
  ) {
    return this.svc.publishOutbound(id, dto);
  }
}
