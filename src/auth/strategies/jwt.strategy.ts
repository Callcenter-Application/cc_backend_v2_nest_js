import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { roleEnum } from '../../user/enums/roleEnum.js';
import { AuthService } from '../auth.service.js';

export interface JwtPayload {
  sub: number;
  email: string;
  role: roleEnum;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: roleEnum;
}

export const extractBearerToken = ExtractJwt.fromAuthHeaderAsBearerToken();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: extractBearerToken,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthenticatedUser> {
    const token = extractBearerToken(req);
    if (!token || (await this.authService.isTokenRevoked(token))) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
