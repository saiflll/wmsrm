import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgUser } from './fg-user.entity.js';
import { FgUsersService } from './fg-users.service.js';
import { FgUsersController } from './fg-users.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgUser])],
  controllers: [FgUsersController],
  providers: [FgUsersService],
  exports: [FgUsersService, TypeOrmModule],
})
export class FgUsersModule {}
