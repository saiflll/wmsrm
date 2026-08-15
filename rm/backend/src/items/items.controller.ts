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
// import { JwtAuthGuard } from '../admin/auth/jwt-auth.guard'; // Will add later

@Controller('items')
// @UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly items_service: ItemsService) {}

  @Get()
  find_all(): Promise<Item[]> {
    return this.items_service.find_all();
  }

  @Get(':id')
  find_one(@Param('id') id: string): Promise<Item | null> {
    return this.items_service.find_one(+id);
  }

  @Post()
  create(@Body() item: Partial<Item>): Promise<Item> {
    return this.items_service.create(item);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() item: Partial<Item>,
  ): Promise<Item | null> {
    return this.items_service.update(+id, item);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.items_service.remove(+id);
  }
}
