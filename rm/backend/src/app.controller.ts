import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './admin/auth/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly app_service: AppService) {}

  @Get()
  get_hello(): string {
    return this.app_service.get_hello();
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  get_profile(@Request() req) {
    return req.user;
  }
}
