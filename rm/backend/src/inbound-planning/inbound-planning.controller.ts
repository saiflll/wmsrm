import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { InboundPlanningService } from './inbound-planning.service';
import {
  CreateInboundPlanningDto,
  UpdateInboundPlanningDto,
  ProcessInboundDto,
} from './inbound-planning.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inbound-planning')
@UseGuards(JwtAuthGuard)
export class InboundPlanningController {
  constructor(private readonly svc: InboundPlanningService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInboundPlanningDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInboundPlanningDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }

  @Post(':id/process')
  processInbound(@Param('id', ParseIntPipe) id: number, @Body() dto: ProcessInboundDto) {
    return this.svc.processInbound(id, dto);
  }
}
