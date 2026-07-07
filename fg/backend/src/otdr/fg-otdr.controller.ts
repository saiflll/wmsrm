import { Controller, Get, Post, Put, Body, Query, UseGuards, Request } from '@nestjs/common';
import { FgOtdrService } from './fg-otdr.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('otdr')
@UseGuards(JwtAuthGuard)
export class FgOtdrController {
  constructor(private otdrService: FgOtdrService) {}

  @Get()
  async getList(@Query('status') status?: string) {
    return this.otdrService.getOtdrList(status);
  }

  @Get('summary')
  async getSummary() {
    return this.otdrService.getSummary();
  }

  @Put('muat')
  async updateMuat(@Body() body: any, @Request() req) {
    body.namaUserUpdate = req.user.username;
    return this.otdrService.updateMuat(body.idOtdr, body);
  }

  @Put('complete')
  async markComplete(@Body() body: { idOtdr: string }, @Request() req) {
    return this.otdrService.markComplete(body.idOtdr, req.user.username);
  }
}
