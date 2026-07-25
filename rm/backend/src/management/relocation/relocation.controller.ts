import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { RelocationService } from './relocation.service';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';
import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';
import { CreateRelocationDto } from './relocation.dto';

@Controller('relocation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelocationController {
  constructor(private readonly relocationService: RelocationService) {}

  @Get()
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  findAll() {
    return this.relocationService.findAll();
  }

  @Post()
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  createRelocation(@Body() dto: CreateRelocationDto) {
    return this.relocationService.createRelocation(dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  executeRelocation(@Param('id') id: string) {
    return this.relocationService.executeRelocation(+id);
  }

  @Delete(':id')
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  deleteRelocation(@Param('id') id: string) {
    return this.relocationService.deleteRelocation(+id);
  }
}
