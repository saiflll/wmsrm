import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../users/user.entity';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: any, @Req() req: Request) {
    const user = await this.authService.validateUser(
      body.username,
      body.password,
    );
    const ip = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    if (!user) {
      await this.authService.loginFailed(body.username, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user, ip, userAgent);
  }

  @SkipThrottle()
  @Get('login-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getLoginLogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.authService.getLoginLogs(Number(page), Number(limit));
  }
}
