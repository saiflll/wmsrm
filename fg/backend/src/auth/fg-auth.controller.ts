import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { FgAuthService } from './fg-auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller()
export class FgAuthController {
  constructor(private authService: FgAuthService) {}

  @Post('auth/login')
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.username);
  }
}
