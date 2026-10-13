import { ApiProperty } from '@nestjs/swagger';
import { roleEnum } from '../enums/roleEnum.js';
import { Index } from 'typeorm';

export class CreateUserDto {
  @ApiProperty({
    description: 'Enter your fisrtname without spaces',
    example: 'Luis',
  })
  firstName: string;

  @ApiProperty({
    description: 'Enter your lastname without spaces',
    example: 'Reyes',
  })
  lastName: string;

  @ApiProperty({
    description: 'Enter your email address, one per account',
    example: 'luisreyes@email.com',
  })
  email: string;

  @ApiProperty({
    description: 'Enter a secure password',
    example: 'SuperSecurePassword123@',
  })
  password: string;

  @ApiProperty({
    description: 'Select the User Role',
    enum: roleEnum,
    default: roleEnum.ADMINISTRATOR,
  })
  @Index()
  role: roleEnum;

  @ApiProperty({
    default: true,
  })
  isActive: boolean;
}
