import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { GudangService } from './gudang.service';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';

import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';

@Controller('gudang')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GudangController {
  constructor(private readonly svc: GudangService) {}

  @Get()
  find_all(
    @Query('side') side?: string,
    @Query('zone') zone?: string,
    @Query('search') search?: string,
  ) {
    const s = side === 'true' ? true : side === 'false' ? false : undefined;
    return this.svc.find_all(s, zone, search);
  }

  @Get('zones')
  get_zones() {
    return this.svc.get_zones_summary();
  }

  @Get('slot')
  find_by_slot(@Query('name') name: string) {
    return this.svc.find_by_slot(name);
  }

  @Get('zone/:zone')
  find_by_zone(@Param('zone') zone: string) {
    return this.svc.find_by_zone(zone);
  }

  @Get(':id')
  find_one(@Param('id') id: string) {
    return this.svc.find_one(+id);
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  create(@Body() data: any) {
    return this.svc.create(data);
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() data: any) {
    return this.svc.update(+id, data);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string, @Query('cascade') cascade?: string) {
    return this.svc.remove(+id, cascade === 'true');
  }
}
