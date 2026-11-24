import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import type { Request } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = { login: vi.fn(), logout: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('login delegates to the service', async () => {
    const dto = { email: 'a@b.com', password: 'x' };
    authService.login.mockResolvedValue({ access_token: 't' });

    await expect(controller.login(dto)).resolves.toEqual({ access_token: 't' });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('logout passes the bearer token to the service', async () => {
    authService.logout.mockResolvedValue({ message: 'Logged out successfully' });
    const req = { headers: { authorization: 'Bearer my.jwt' } } as Request;

    await expect(controller.logout(req)).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(authService.logout).toHaveBeenCalledWith('my.jwt');
  });

  it('logout throws if there is no bearer token', () => {
    const req = { headers: {} } as Request;

    expect(() => controller.logout(req)).toThrow(UnauthorizedException);
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('logout is protected by JwtAuthGuard and login is public', () => {
    const reflector = new Reflector();
    const handlers = Object.getOwnPropertyDescriptors(AuthController.prototype);
    expect(reflector.get(GUARDS_METADATA, handlers.logout.value!)).toEqual([
      JwtAuthGuard,
    ]);
    expect(
      reflector.get(GUARDS_METADATA, handlers.login.value!),
    ).toBeUndefined();
  });
});
