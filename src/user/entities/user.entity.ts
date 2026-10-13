import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { roleEnum } from '../enums/roleEnum.js';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Add your firstname', example: 'Luis' })
  @Column()
  firstName: string;

  @ApiProperty({ description: 'Add your lastname', example: 'Reyes' })
  @Column()
  lastName: string;

  @ApiProperty({
    description: 'Add your Email address, one per account',
    example: 'luisreyes@email.com',
  })
  @Column()
  email: string;

  @ApiProperty({
    description: 'Enter a secure password',
    example: 'SuperSecurePassword123@',
  })
  @Column()
  password: string;

  @ApiProperty({
    description: 'Choose between Admin, Supervisor or Operator',
    enum: roleEnum,
    example: roleEnum.ADMINISTRATOR,
  })
  @Index()
  @Column({
    type: 'enum',
    enum: roleEnum,
    default: roleEnum.OPERATOR,
  })
  role: roleEnum;

  @Column()
  isActive: boolean;
}
