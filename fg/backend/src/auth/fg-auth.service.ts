import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { FgUser } from '../users/fg-user.entity.js';

@Injectable()
export class FgAuthService {
  constructor(
    @InjectRepository(FgUser) private userRepo: Repository<FgUser>,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('Username tidak ditemukan');
    if (user.status !== 'AKTIF') throw new UnauthorizedException('User tidak aktif');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Password salah');

    const payload = { username: user.username, sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        namaUser: user.namaUser,
        role: user.role,
        access: this.buildAccess(user),
      },
    };
  }

  async getProfile(username: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('User tidak ditemukan');
    return {
      id: user.id,
      username: user.username,
      namaUser: user.namaUser,
      role: user.role,
      access: this.buildAccess(user),
    };
  }

  private buildAccess(user: FgUser) {
    const isSpv = user.role === 'SUPERVISOR' || user.aksesSupervisor === 'YA';
    const isIn = user.role === 'KOORDINATOR_IN';
    const isOut = user.role === 'KOORDINATOR_OUT';
    const isInv = user.role === 'INVENTORY';
    const isQc = user.role === 'QUALITY_CONTROL';
    const isAdmin = user.role === 'ADMIN';

    return {
      masuk: isSpv || isIn || user.aksesBarangMasuk === 'YA',
      keluar: isSpv || isOut || user.aksesBarangKeluar === 'YA',
      otdr: isSpv || isOut || user.aksesOtdr === 'YA',
      lokasi: isSpv || isInv || user.aksesLokasi === 'YA',
      stockOpname: isSpv || isInv || user.aksesLokasi === 'YA',
      occupancy: isSpv || isInv || user.aksesLokasi === 'YA',
      fifoQc: isSpv || isQc,
      mutasi: isSpv || isIn || isOut,
      rackQr: isSpv || isIn || isOut,
      adminIt: isSpv || isAdmin,
      supervisor: isSpv,
    };
  }
}
