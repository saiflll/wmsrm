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
  constructor(private readonly relocation_service: RelocationService) {}

  @Get()
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  find_all() {
    return this.relocation_service.find_all();
  }

  @Post()
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  create_relocation(@Body() dto: CreateRelocationDto) {
    return this.relocation_service.create_relocation(dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  execute_relocation(@Param('id') id: string) {
    return this.relocation_service.execute_relocation(+id);
  }

  @Delete(':id')
  @Roles(UserRole.CHECKER, UserRole.ADMIN, UserRole.KOORDINATOR, UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  delete_relocation(@Param('id') id: string) {
    return this.relocation_service.delete_relocation(+id);
  }
}
