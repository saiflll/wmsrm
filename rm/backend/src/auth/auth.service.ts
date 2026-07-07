import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LoginLog } from '../users/login-log.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(LoginLog)
        private readonly loginLogRepo: Repository<LoginLog>,
        private readonly jwtService: JwtService,
    ) { }

    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.userRepo.findOneBy({ username });
        if (user && (await bcrypt.compare(pass, user.pass))) {
            const { pass, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any, ip?: string, userAgent?: string) {
        const payload = { username: user.username, sub: user.id, role: user.role };
        await this.loginLogRepo.save(this.loginLogRepo.create({
            userId: user.id,
            username: user.username,
            ip: ip || '',
            userAgent: userAgent || '',
            success: true,
        }));
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            }
        };
    }

    async loginFailed(username: string, ip?: string, userAgent?: string) {
        await this.loginLogRepo.save(this.loginLogRepo.create({
            userId: 0,
            username: username || 'unknown',
            ip: ip || '',
            userAgent: userAgent || '',
            success: false,
        }));
    }

    async getLoginLogs(page: number = 1, limit: number = 50) {
        const [logs, total] = await this.loginLogRepo.findAndCount({
            order: { loginAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { logs, total, page, limit };
    }
}
