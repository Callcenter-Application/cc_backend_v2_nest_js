import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { User } from '../user/entities/user.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { RevokedToken } from './entities/revoked-token.entity.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email, isActive: true },
    });

    if (!user || !(await compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  /**
   * Revokes the given (already verified) access token until it expires.
   */
  async logout(token: string) {
    const payload = this.jwtService.decode<JwtPayload | null>(token);
    if (!payload?.exp) {
      throw new UnauthorizedException('Invalid token');
    }

    await this.revokedTokenRepository.upsert(
      { tokenHash: hashToken(token), expiresAt: new Date(payload.exp * 1000) },
      ['tokenHash'],
    );
    // Housekeeping: tokens past their expiry are rejected by passport-jwt anyway.
    await this.revokedTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return { message: 'Logged out successfully' };
  }

  isTokenRevoked(token: string) {
    return this.revokedTokenRepository.existsBy({
      tokenHash: hashToken(token),
    });
  }
}
