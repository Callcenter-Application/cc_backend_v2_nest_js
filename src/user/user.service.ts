import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { hash } from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = this.userRepository.create(createUserDto);
    user.isActive = true;
    user.password = await hash(createUserDto.password, PASSWORD_SALT_ROUNDS);
    // A single INSERT ... RETURNING: no BEGIN/COMMIT round trips around it.
    return this.userRepository.save(user, { transaction: false });
  }

  findAll() {
    return this.userRepository.find({ where: { isActive: true } });
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOneBy({ id, isActive: true });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const { password, ...rest } = updateUserDto;
    const changes = password
      ? { ...rest, password: await hash(password, PASSWORD_SALT_ROUNDS) }
      : rest;
    return this.updateActiveUser(id, changes);
  }

  remove(id: number) {
    return this.updateActiveUser(id, { isActive: false });
  }

  /**
   * Updates an active user and returns the updated row in one round trip
   * (UPDATE ... WHERE id AND isActive RETURNING *). No row means the user
   * doesn't exist or was soft-deleted.
   */
  private async updateActiveUser(
    id: number,
    changes: QueryDeepPartialEntity<User>,
  ): Promise<User> {
    const result = await this.userRepository
      .createQueryBuilder()
      .update()
      .set(changes)
      .where({ id, isActive: true })
      .returning('*')
      .execute();

    const [user] = result.raw as User[];
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }
}
