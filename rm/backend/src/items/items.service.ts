import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
  ) {}

  findAll(): Promise<Item[]> {
    return this.itemsRepository.find();
  }

  findOne(id: number): Promise<Item | null> {
    return this.itemsRepository.findOneBy({ id });
  }

  create(item: Partial<Item>): Promise<Item> {
    const newItem = this.itemsRepository.create(item);
    return this.itemsRepository.save(newItem);
  }

  async update(id: number, item: Partial<Item>): Promise<Item | null> {
    await this.itemsRepository.update(id, item);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.itemsRepository.delete(id);
  }
}
