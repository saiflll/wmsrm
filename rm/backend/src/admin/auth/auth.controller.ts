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
  constructor(private readonly auth_service: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: any, @Req() req: Request) {
    const user = await this.auth_service.validate_user(
      body.username,
      body.password,
    );
    const ip = req.ip || req.socket?.remoteAddress || '';
    const user_agent = req.headers['user-agent'] || '';
    if (!user) {
      await this.auth_service.login_failed(body.username, ip, user_agent);
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.auth_service.login(user, ip, user_agent);
  }

  @SkipThrottle()
  @Get('login-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async get_login_logs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.auth_service.get_login_logs(Number(page), Number(limit));
  }
}
