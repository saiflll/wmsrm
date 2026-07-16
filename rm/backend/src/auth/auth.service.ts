import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LoginLog } from '../users/login-log.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LoginLog)
    private readonly loginLogRepo: Repository<LoginLog>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    try {
      this.logger.debug(`Attempting to validate user: ${username}`);
      const user = await this.userRepo.findOneBy({ username });
      
      if (!user) {
        this.logger.warn(`User not found: ${username}`);
        return null;
      }

      this.logger.debug(`User found: ${username}, comparing passwords...`);
      const isPasswordValid = await bcrypt.compare(pass, user.pass);
      
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for user: ${username}`);
        return null;
      }

      this.logger.log(`User validated successfully: ${username}`);
      const { pass: _password, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error(`Error validating user ${username}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async login(user: any, ip?: string, userAgent?: string) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    await this.loginLogRepo.save(
      this.loginLogRepo.create({
        userId: user.id,
        username: user.username,
        ip: ip || '',
        userAgent: userAgent || '',
        success: true,
      }),
    );
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async loginFailed(username: string, ip?: string, userAgent?: string) {
    await this.loginLogRepo.save(
      this.loginLogRepo.create({
        userId: null,
        username: username || 'unknown',
        ip: ip || '',
        userAgent: userAgent || '',
        success: false,
      }),
    );
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
