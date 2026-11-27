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

  // Chainable stand-in for the UPDATE ... RETURNING query builder.
  const qb = {
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
    execute: vi.fn(),
  };
  const repo = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOneBy: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const existingUser = {
    id: 1,
    firstName: 'Luis',
    lastName: 'Reyes',
    email: 'luisreyes@email.com',
    password: 'stored-hash',
    role: roleEnum.OPERATOR,
    isActive: true,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    repo.createQueryBuilder.mockReturnValue(qb);
    qb.update.mockReturnValue(qb);
    qb.set.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    qb.returning.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('hashes the password, forces isActive and saves without a transaction', async () => {
      const dto = {
        firstName: 'Ana',
        lastName: 'Gomez',
        email: 'ana@email.com',
        password: 'Plain123@',
        role: roleEnum.SUPERVISOR,
        isActive: false,
      } as CreateUserDto;
      repo.create.mockImplementation((d: Partial<User>) => Object.assign({}, d));
      repo.save.mockImplementation((u: User) =>
        Promise.resolve(Object.assign(u, { id: 7 })),
      );

      const result = await service.create(dto);

      const [saved, options] = repo.save.mock.calls[0] as [User, object];
      expect(saved.isActive).toBe(true);
      expect(saved.email).toBe('ana@email.com');
      expect(saved.password).not.toBe('Plain123@');
      await expect(compare('Plain123@', saved.password)).resolves.toBe(true);
      expect(options).toEqual({ transaction: false });
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
    it('updates an active user in one query and returns the updated row', async () => {
      const updated = { ...existingUser, firstName: 'Luisito' };
      qb.execute.mockResolvedValue({ raw: [updated] });

      await expect(service.update(1, { firstName: 'Luisito' })).resolves.toBe(
        updated,
      );
      expect(qb.set).toHaveBeenCalledWith({ firstName: 'Luisito' });
      expect(qb.where).toHaveBeenCalledWith({ id: 1, isActive: true });
      expect(qb.returning).toHaveBeenCalledWith('*');
      expect(repo.findOneBy).not.toHaveBeenCalled();
    });

    it('hashes a new password before saving it', async () => {
      qb.execute.mockResolvedValue({ raw: [existingUser] });

      await service.update(1, { password: 'NewPass123@', lastName: 'R' });

      const [changes] = qb.set.mock.calls[0];
      expect(changes.lastName).toBe('R');
      expect(changes.password).not.toBe('NewPass123@');
      await expect(compare('NewPass123@', changes.password)).resolves.toBe(true);
    });

    it('throws NotFoundException when no active user matches', async () => {
      qb.execute.mockResolvedValue({ raw: [] });

      await expect(service.update(99, { firstName: 'X' })).rejects.toThrow(
        new NotFoundException('User #99 not found'),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting isActive to false and returns the row', async () => {
      const removed = { ...existingUser, isActive: false };
      qb.execute.mockResolvedValue({ raw: [removed] });

      await expect(service.remove(1)).resolves.toBe(removed);
      expect(qb.set).toHaveBeenCalledWith({ isActive: false });
      expect(qb.where).toHaveBeenCalledWith({ id: 1, isActive: true });
    });

    it('throws NotFoundException for a missing or already removed user', async () => {
      qb.execute.mockResolvedValue({ raw: [] });

      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
