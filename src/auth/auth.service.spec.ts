import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { User } from '../user/entities/user.entity.js';
import { RevokedToken } from './entities/revoked-token.entity.js';

describe('AuthService', () => {
  let service: AuthService;
  const revokedTokenRepository = {
    upsert: vi.fn(),
    delete: vi.fn(),
    existsBy: vi.fn(),
  };
  const jwtService = { decode: vi.fn(), signAsync: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: { findOne: vi.fn() } },
        {
          provide: getRepositoryToken(RevokedToken),
          useValue: revokedTokenRepository,
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('logout stores a hash of the token with its expiry', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    jwtService.decode.mockReturnValue({ sub: 1, exp });

    await expect(service.logout('some.jwt.token')).resolves.toEqual({
      message: 'Logged out successfully',
    });

    const [row, conflictPaths] = revokedTokenRepository.upsert.mock.calls[0];
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.tokenHash).not.toContain('some.jwt.token');
    expect(row.expiresAt).toEqual(new Date(exp * 1000));
    expect(conflictPaths).toEqual(['tokenHash']);
  });

  it('logout rejects a token without exp', async () => {
    jwtService.decode.mockReturnValue(null);
    await expect(service.logout('bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revokedTokenRepository.upsert).not.toHaveBeenCalled();
  });

  it('isTokenRevoked looks the token up by the same hash', async () => {
    jwtService.decode.mockReturnValue({ exp: 9999999999 });
    await service.logout('abc');
    const storedHash = revokedTokenRepository.upsert.mock.calls[0][0].tokenHash;

    revokedTokenRepository.existsBy.mockResolvedValue(true);
    await expect(service.isTokenRevoked('abc')).resolves.toBe(true);
    expect(revokedTokenRepository.existsBy).toHaveBeenCalledWith({
      tokenHash: storedHash,
    });
  });
});
