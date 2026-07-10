import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OutboundAyamService } from './outbound-ayam.service';
import { CreateOutboundAyamDto, UpdateOutboundAyamDto } from './outbound-ayam.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('outbound-ayam')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutboundAyamController {
    constructor(private readonly svc: OutboundAyamService) { }

    @Get()
    @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN, UserRole.CHECKER)
    findAll() {
        return this.svc.findAll();
    }

    @Get(':id')
    @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN, UserRole.CHECKER)
    findOne(@Param('id') id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN, UserRole.CHECKER)
    create(@Body() dto: CreateOutboundAyamDto) {
        return this.svc.create(dto);
    }

    @Put(':id')
    @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
    update(@Param('id') id: number, @Body() dto: UpdateOutboundAyamDto) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.SUPERVISOR, UserRole.KOORDINATOR, UserRole.SUPER_ADMIN)
    remove(@Param('id') id: number) {
        return this.svc.remove(id);
    }
}
