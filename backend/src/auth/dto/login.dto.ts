import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@airtronic.com',
    description: 'User registered email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'Secret@123',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
