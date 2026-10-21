import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UserOverrideItemDto {
  @IsString()
  moduleKey!: string;

  @IsIn(['GRANT', 'REVOKE', 'INHERIT', 'FULL_ACCESS', 'VIEW', 'DENY'])
  action!: 'GRANT' | 'REVOKE' | 'INHERIT' | 'FULL_ACCESS' | 'VIEW' | 'DENY';
}

export class UpdateUserPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserOverrideItemDto)
  overrides!: UserOverrideItemDto[];
}
