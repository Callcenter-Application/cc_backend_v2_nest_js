import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Registered email address',
    example: 'luisreyes@email.com',
  })
  email: string;

  @ApiProperty({
    description: 'Account password',
    example: 'SuperSecurePassword123@',
  })
  password: string;
}
