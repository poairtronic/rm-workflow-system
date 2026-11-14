import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TestSendEmailDto {
  @IsEmail()
  @IsNotEmpty()
  recipientEmail: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
