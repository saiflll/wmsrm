import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { FgDriverDashboardService } from './fg-driver-dashboard.service.js';

@Controller('driver-dashboard')
export class FgDriverDashboardController {
  constructor(private dashboardService: FgDriverDashboardService) {}

  @Get()
  async getDashboard(@Query('token') token: string) {
    return this.dashboardService.getDashboard(token);
  }

  @Post('evidence')
  async submitEvidence(@Body() body: any) {
    return this.dashboardService.submitEvidence(body.token, body);
  }
}
