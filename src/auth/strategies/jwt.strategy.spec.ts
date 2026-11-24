import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtStrategy, extractBearerToken } from './jwt.strategy.js';
import { AuthService } from '../auth.service.js';
import { roleEnum } from '../../user/enums/roleEnum.js';

const requestWith = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} }) as Request;

describe('JwtStrategy', () => {
  const authService = { isTokenRevoked: vi.fn() };
  const getOrThrow = vi.fn().mockReturnValue('test-secret');
  const config = { getOrThrow } as unknown as ConfigService;
  const strategy = new JwtStrategy(
    config,
    authService as unknown as AuthService,
  );
  const payload = { sub: 3, email: 'a@b.com', role: roleEnum.SUPERVISOR };

  beforeEach(() => authService.isTokenRevoked.mockReset());

  it('reads the JWT secret from config', () => {
    expect(getOrThrow).toHaveBeenCalledWith('jwt.secret');
  });

  it('maps a valid, non-revoked token payload to the authenticated user', async () => {
    authService.isTokenRevoked.mockResolvedValue(false);

    await expect(
      strategy.validate(requestWith('Bearer good.token'), payload),
    ).resolves.toEqual({ id: 3, email: 'a@b.com', role: roleEnum.SUPERVISOR });
    expect(authService.isTokenRevoked).toHaveBeenCalledWith('good.token');
  });

  it('rejects a revoked token', async () => {
    authService.isTokenRevoked.mockResolvedValue(true);

    await expect(
      strategy.validate(requestWith('Bearer revoked.token'), payload),
    ).rejects.toThrow(new UnauthorizedException('Token has been revoked'));
  });

  it('rejects when no bearer token is present', async () => {
    await expect(strategy.validate(requestWith(), payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.isTokenRevoked).not.toHaveBeenCalled();
  });

  it('extractBearerToken only accepts the Bearer scheme', () => {
    expect(extractBearerToken(requestWith('Bearer abc'))).toBe('abc');
    expect(extractBearerToken(requestWith('Basic abc'))).toBeNull();
  });
});
