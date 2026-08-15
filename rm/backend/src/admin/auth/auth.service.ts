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
    private readonly user_repo: Repository<User>,
    @InjectRepository(LoginLog)
    private readonly login_log_repo: Repository<LoginLog>,
    private readonly jwt_service: JwtService,
  ) {}

  async validate_user(username: string, pass: string): Promise<any> {
    try {
      this.logger.debug(`Attempting to validate user: ${username}`);
      const user = await this.user_repo.findOneBy({ username });

      if (!user) {
        this.logger.warn(`User not found: ${username}`);
        return null;
      }

      if (user.is_active === false) {
        this.logger.warn(`Inactive account login attempt: ${username}`);
        throw new UnauthorizedException('Akun tidak aktif');
      }

      this.logger.debug(`User found: ${username}, comparing passwords...`);
      const is_password_valid = await bcrypt.compare(pass, user.pass);

      if (!is_password_valid) {
        this.logger.warn(`Invalid password for user: ${username}`);
        return null;
      }

      this.logger.log(`User validated successfully: ${username}`);
      const { pass: _password, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error(
        `Error validating user ${username}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async login(user: any, ip?: string, user_agent?: string) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    await this.login_log_repo.save(
      this.login_log_repo.create({
        user_id: user.id,
        username: user.username,
        ip: ip || '',
        user_agent: user_agent || '',
        success: true,
      }),
    );
    return {
      access_token: this.jwt_service.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async login_failed(username: string, ip?: string, user_agent?: string) {
    await this.login_log_repo.save(
      this.login_log_repo.create({
        user_id: null,
        username: username || 'unknown',
        ip: ip || '',
        user_agent: user_agent || '',
        success: false,
      }),
    );
  }

  async get_login_logs(page: number = 1, limit: number = 50) {
    const [logs, total] = await this.login_log_repo.findAndCount({
      order: { login_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { logs, total, page, limit };
  }
}
