import { IsOptional, IsString, IsEnum } from 'class-validator';
import { UserRole } from '../enums/role.enum.js';

export class DevTokenDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  userId?: string;
}
