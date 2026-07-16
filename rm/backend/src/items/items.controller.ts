import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { Item } from './item.entity';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Will add later

@Controller('items')
// @UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(): Promise<Item[]> {
    return this.itemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Item | null> {
    return this.itemsService.findOne(+id);
  }

  @Post()
  create(@Body() item: Partial<Item>): Promise<Item> {
    return this.itemsService.create(item);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() item: Partial<Item>,
  ): Promise<Item | null> {
    return this.itemsService.update(+id, item);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.itemsService.remove(+id);
  }
}
