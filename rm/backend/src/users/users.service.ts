import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async findAll(): Promise<User[]> {
        const users = await this.userRepo.find();
        return users.map(u => {
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
        const user = this.userRepo.create({ username: dto.username, pass: hashed, role: dto.role });
        const saved = await this.userRepo.save(user);
        const { pass, ...rest } = saved;
        return rest as User;
    }

    async update(id: number, dto: UpdateUserDto): Promise<User> {
        const user = await this.userRepo.findOneBy({ id });
        if (!user) throw new NotFoundException('User not found');
        if (dto.username && dto.username !== user.username) {
            const existing = await this.userRepo.findOneBy({ username: dto.username });
            if (existing) throw new ConflictException('Username already exists');
            user.username = dto.username;
        }
        if (dto.password) {
            user.pass = await bcrypt.hash(dto.password, 10);
        }
        if (dto.role !== undefined) {
            user.role = dto.role;
        }
        const saved = await this.userRepo.save(user);
        const { pass, ...rest } = saved;
        return rest as User;
    }

    async remove(id: number): Promise<void> {
        const user = await this.userRepo.findOneBy({ id });
        if (!user) throw new NotFoundException('User not found');
        await this.userRepo.remove(user);
    }
}
