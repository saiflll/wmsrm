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
import { OutboundAyamService } from './outbound-ayam.service';
import {
  CreateOutboundAyamDto,
  UpdateOutboundAyamDto,
  ProcessOutboundAyamDto,
  PublishOutboundAyamDto,
} from './outbound-ayam.dto';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';
import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';

@Controller('outbound-ayam')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutboundAyamController {
  constructor(private readonly svc: OutboundAyamService) {}

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
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.CHECKER,
  )
  create(@Body() dto: CreateOutboundAyamDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOutboundAyamDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.svc.remove(id, req.user?.id);
  }

  @Post(':id/process')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  processOutbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessOutboundAyamDto,
  ) {
    return this.svc.processOutbound(id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  publishOutbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishOutboundAyamDto,
  ) {
    return this.svc.publishOutbound(id, dto);
  }
}
