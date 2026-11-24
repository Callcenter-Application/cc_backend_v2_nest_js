import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { UserService } from './user.service.js';
import { User } from './entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { roleEnum } from './enums/roleEnum.js';

describe('UserService', () => {
  let service: UserService;
  const repo = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOneBy: vi.fn(),
    update: vi.fn(),
  };

  const existingUser = {
    id: 1,
    firstName: 'Luis',
    lastName: 'Reyes',
    email: 'luis@email.com',
    password: 'stored-hash',
    role: roleEnum.OPERATOR,
    isActive: true,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('hashes the password, forces isActive and saves', async () => {
      const dto = {
        firstName: 'Ana',
        lastName: 'Gomez',
        email: 'ana@email.com',
        password: 'Plain123@',
        role: roleEnum.SUPERVISOR,
        isActive: false,
      } as CreateUserDto;
      repo.create.mockImplementation((d: CreateUserDto) => Object.assign({}, d));
      repo.save.mockImplementation((u: User) =>
        Promise.resolve(Object.assign(u, { id: 7 })),
      );

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      const saved = repo.save.mock.calls[0][0] as User;
      expect(saved.isActive).toBe(true);
      expect(saved.password).not.toBe('Plain123@');
      await expect(compare('Plain123@', saved.password)).resolves.toBe(true);
      expect(result.id).toBe(7);
    });
  });

  describe('findAll', () => {
    it('returns only active users', async () => {
      repo.find.mockResolvedValue([existingUser]);

      await expect(service.findAll()).resolves.toEqual([existingUser]);
      expect(repo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });

  describe('findOne', () => {
    it('returns an active user by id', async () => {
      repo.findOneBy.mockResolvedValue(existingUser);

      await expect(service.findOne(1)).resolves.toBe(existingUser);
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 1, isActive: true });
    });

    it('throws NotFoundException when the user does not exist or is inactive', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(
        new NotFoundException('User #99 not found'),
      );
    });
  });

  describe('update', () => {
    it('updates fields without touching the password when none is sent', async () => {
      const updated = { ...existingUser, firstName: 'Luisito' };
      repo.findOneBy
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(updated);

      const result = await service.update(1, { firstName: 'Luisito' });

      expect(repo.update).toHaveBeenCalledWith(1, { firstName: 'Luisito' });
      expect(result).toBe(updated);
    });

    it('hashes a new password before saving it', async () => {
      repo.findOneBy.mockResolvedValue(existingUser);

      await service.update(1, { password: 'NewPass123@', lastName: 'R' });

      const [id, changes] = repo.update.mock.calls[0];
      expect(id).toBe(1);
      expect(changes.lastName).toBe('R');
      expect(changes.password).not.toBe('NewPass123@');
      await expect(compare('NewPass123@', changes.password)).resolves.toBe(true);
    });

    it('throws NotFoundException and does not update a missing user', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.update(99, { firstName: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting isActive to false', async () => {
      repo.findOneBy.mockResolvedValue(existingUser);

      await expect(service.remove(1)).resolves.toBe(existingUser);
      expect(repo.update).toHaveBeenCalledWith(1, { isActive: false });
    });

    it('throws NotFoundException for a missing user', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
