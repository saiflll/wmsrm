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
  Request,
} from '@nestjs/common';
import { InboundPlanningService } from './inbound-planning.service';
import {
  CreateInboundPlanningDto,
  UpdateInboundPlanningDto,
  ProcessInboundDto,
} from './inbound-planning.dto';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';
import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';

@Controller('inbound-planning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InboundPlanningController {
  constructor(private readonly svc: InboundPlanningService) {}

  @Get()
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.CHECKER,
    UserRole.ADMIN,
  )
  find_all(@Query('page') page?: number, @Query('limit') limit?: number) {
    const p = page ? Number(page) : 1;
    const l = limit ? Number(limit) : 50;
    return this.svc.find_all(p, l);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.CHECKER,
    UserRole.ADMIN,
  )
  find_one(@Param('id', ParseIntPipe) id: number) {
    return this.svc.find_one(id);
  }

  @Post()
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(@Body() dto: CreateInboundPlanningDto, @Request() req: any) {
    return this.svc.create(dto, req.user?.username);
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInboundPlanningDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.svc.remove(id, req.user?.id);
  }

  @Post(':id/process')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.CHECKER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  process_inbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessInboundDto,
    @Request() req,
  ) {
    return this.svc.process_inbound(
      id,
      dto,
      req.user?.role || 'USER',
      req.user?.id,
      req.user?.username,
    );
  }
}
