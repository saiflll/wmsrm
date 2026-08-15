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
  find_all() {
    return this.svc.find_all();
  }

  @Get('filter')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.KOORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.CHECKER,
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
  )
  find_one(@Param('id', ParseIntPipe) id: number) {
    return this.svc.find_one(id);
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
  process_outbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessOutboundAyamDto,
  ) {
    return this.svc.process_outbound(id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  publish_outbound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishOutboundAyamDto,
  ) {
    return this.svc.publish_outbound(id, dto);
  }
}
