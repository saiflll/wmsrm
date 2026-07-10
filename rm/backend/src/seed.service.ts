import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './users/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
    constructor(
        @InjectRepository(User) private userRepo: Repository<User>,
    ) { }

    async onApplicationBootstrap() {
        await this.seedUsers();
    }

    private async seedUsers() {
        const hasUsers = await this.userRepo.count() > 0;
        if (!hasUsers) {
            const users = [
                { username: 'checker',     pass: await bcrypt.hash('checker123', 10), role: UserRole.CHECKER },
                { username: 'admin',       pass: await bcrypt.hash('admin123',   10), role: UserRole.ADMIN },
                { username: 'koordinator', pass: await bcrypt.hash('koord123',   10), role: UserRole.KOORDINATOR },
                { username: 'supervisor',  pass: await bcrypt.hash('super123',   10), role: UserRole.SUPERVISOR },
                { username: 'superadmin',  pass: await bcrypt.hash('super123',   10), role: UserRole.SUPER_ADMIN },
                { username: 'manager',     pass: await bcrypt.hash('manager123', 10), role: UserRole.MANAGER },
            ];
            await this.userRepo.save(this.userRepo.create(users));
            console.log('✅ Seed users');
        } else {
            // Pastikan superadmin selalu ada
            const superadminExists = await this.userRepo.findOne({ where: { username: 'superadmin' } });
            if (!superadminExists) {
                const sa = this.userRepo.create({
                    username: 'superadmin',
                    pass: await bcrypt.hash('super123', 10),
                    role: UserRole.SUPER_ADMIN,
                });
                await this.userRepo.save(sa);
                console.log('✅ Added missing superadmin user');
            }
        }
    }
}
