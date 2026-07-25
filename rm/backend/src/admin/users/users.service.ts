import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    const users = await this.userRepo.find({ where: { deleted_at: IsNull() } });
    return users.map((u) => {
      const { pass, ...rest } = u;
      return rest as User;
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    const { pass, ...rest } = user;
    return rest as User;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOneBy({ username: dto.username });
    if (existing) throw new ConflictException('Username already exists');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      username: dto.username,
      pass: hashed,
      nama: dto.nama || '',
      role: dto.role,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
    });
    const saved = await this.userRepo.save(user);
    const { pass, ...rest } = saved;
    return rest as User;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    if (dto.username && dto.username !== user.username) {
      const existing = await this.userRepo.findOneBy({
        username: dto.username,
      });
      if (existing) throw new ConflictException('Username already exists');
      user.username = dto.username;
    }
    if (dto.password) {
      user.pass = await bcrypt.hash(dto.password, 10);
    }
    if (dto.nama !== undefined) {
      user.nama = dto.nama;
    }
    if (dto.role !== undefined) {
      user.role = dto.role;
    }
    if (dto.is_active !== undefined) {
      user.is_active = dto.is_active;
    }
    const saved = await this.userRepo.save(user);
    const { pass, ...rest } = saved;
    return rest as User;
  }

  async remove(id: number, userId?: number): Promise<void> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(id, {
      deleted_at: new Date(),
      deleted_by: userId || 0,
    });
  }
}
