import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { RelocationService } from './relocation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { CreateRelocationDto } from './relocation.dto';

@Controller('relocation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelocationController {
  constructor(private readonly relocationService: RelocationService) {}

  @Get()
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  findAll() {
    return this.relocationService.findAll();
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  createRelocation(@Body() dto: CreateRelocationDto) {
    return this.relocationService.createRelocation(dto);
  }

  @Post(':id/execute')
  @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR)
  executeRelocation(@Param('id') id: string) {
    return this.relocationService.executeRelocation(+id);
  }
}
