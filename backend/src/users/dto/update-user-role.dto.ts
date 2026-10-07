import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../auth/enums/role.enum.js';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  @IsNotEmpty()
  role!: UserRole;
}

