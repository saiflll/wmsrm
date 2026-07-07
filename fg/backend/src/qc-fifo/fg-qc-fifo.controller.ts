import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { FgQcFifoService } from './fg-qc-fifo.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('qc-fifo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('QUALITY_CONTROL', 'SUPERVISOR')
export class FgQcFifoController {
  constructor(private qcService: FgQcFifoService) {}

  @Get()
  async getMonitoring() {
    return this.qcService.getMonitoring();
  }

  @Put('status')
  async updateStatus(@Body() body: { idStock: string; status: string }, @Request() req) {
    return this.qcService.updateStatus(body.idStock, body.status, req.user.username);
  }
}
