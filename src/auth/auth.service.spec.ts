import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { User } from '../user/entities/user.entity.js';
import { RevokedToken } from './entities/revoked-token.entity.js';
import { roleEnum } from '../user/enums/roleEnum.js';
import { hash } from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  const revokedTokenRepository = {
    upsert: vi.fn(),
    delete: vi.fn(),
    existsBy: vi.fn(),
  };
  const jwtService = { decode: vi.fn(), signAsync: vi.fn() };
  const userRepository = { findOne: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(RevokedToken),
          useValue: revokedTokenRepository,
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const user = {
      id: 4,
      email: 'luis@email.com',
      role: roleEnum.SUPERVISOR,
      isActive: true,
    };

    beforeAll(async () => {
      Object.assign(user, { password: await hash('Correct123@', 4) });
    });

    it('returns a signed token with sub, email and role', async () => {
      userRepository.findOne.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('signed.jwt');

      await expect(
        service.login({ email: user.email, password: 'Correct123@' }),
      ).resolves.toEqual({ access_token: 'signed.jwt' });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: user.email, isActive: true },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 4,
        email: user.email,
        role: roleEnum.SUPERVISOR,
      });
    });

    it('rejects a wrong password', async () => {
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'Wrong' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects an unknown or inactive user with the same message', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@email.com', password: 'x' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
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
    // expired rows are purged
    expect(revokedTokenRepository.delete).toHaveBeenCalledWith({
      expiresAt: expect.objectContaining({ _type: 'lessThan' }),
    });
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
