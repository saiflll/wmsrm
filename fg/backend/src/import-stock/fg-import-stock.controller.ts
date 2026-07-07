import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { FgImportStockService } from './fg-import-stock.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('import-stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERVISOR')
export class FgImportStockController {
  constructor(private importService: FgImportStockService) {}

  @Post()
  async import(@Body() body: any, @Request() req) {
    return this.importService.importStock({ rows: body.rows, namaUser: req.user.username });
  }
}
