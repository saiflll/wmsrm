import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private items_repository: Repository<Item>,
  ) {}

  find_all(): Promise<Item[]> {
    return this.items_repository.find();
  }

  find_one(id: number): Promise<Item | null> {
    return this.items_repository.findOneBy({ id });
  }

  create(item: Partial<Item>): Promise<Item> {
    const new_item = this.items_repository.create(item);
    return this.items_repository.save(new_item);
  }

  async update(id: number, item: Partial<Item>): Promise<Item | null> {
    await this.items_repository.update(id, item);
    return this.find_one(id);
  }

  async remove(id: number): Promise<void> {
    await this.items_repository.delete(id);
  }
}
