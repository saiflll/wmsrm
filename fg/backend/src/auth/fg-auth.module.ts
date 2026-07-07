import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgUser } from '../users/fg-user.entity.js';
import { FgAuthService } from './fg-auth.service.js';
import { FgAuthController } from './fg-auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([FgUser]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'fg_secret',
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FgAuthController],
  providers: [FgAuthService, JwtStrategy],
  exports: [FgAuthService],
})
export class FgAuthModule {}
