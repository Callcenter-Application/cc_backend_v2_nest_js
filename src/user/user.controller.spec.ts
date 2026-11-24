import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { roleEnum } from './enums/roleEnum.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

describe('UserController', () => {
  let controller: UserController;
  const userService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('create delegates to the service', async () => {
    const dto = { email: 'a@b.com' } as CreateUserDto;
    userService.create.mockResolvedValue({ id: 1 });

    await expect(controller.create(dto)).resolves.toEqual({ id: 1 });
    expect(userService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to the service', async () => {
    userService.findAll.mockResolvedValue([]);

    await expect(controller.findAll()).resolves.toEqual([]);
  });

  it('findOne converts the id param to a number', async () => {
    userService.findOne.mockResolvedValue({ id: 5 });

    await controller.findOne('5');
    expect(userService.findOne).toHaveBeenCalledWith(5);
  });

  it('update converts the id param and passes the dto', async () => {
    await controller.update('5', { firstName: 'X' });
    expect(userService.update).toHaveBeenCalledWith(5, { firstName: 'X' });
  });

  it('remove converts the id param to a number', async () => {
    await controller.remove('5');
    expect(userService.remove).toHaveBeenCalledWith(5);
  });

  describe('route protection', () => {
    const reflector = new Reflector();
    const proto = UserController.prototype;

    it.each(['create', 'remove'] as const)(
      '%s requires JWT + ADMINISTRATOR role',
      (method) => {
        expect(reflector.get(GUARDS_METADATA, proto[method])).toEqual([
          JwtAuthGuard,
          RolesGuard,
        ]);
        expect(reflector.get(ROLES_KEY, proto[method])).toEqual([
          roleEnum.ADMINISTRATOR,
        ]);
      },
    );

    it.each(['findAll', 'findOne', 'update'] as const)(
      '%s is currently public (no guards)',
      (method) => {
        expect(reflector.get(GUARDS_METADATA, proto[method])).toBeUndefined();
      },
    );
  });
});
