import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UserOverrideItemDto {
  @IsString()
  moduleKey!: string;

  @IsIn(['GRANT', 'REVOKE', 'INHERIT'])
  action!: 'GRANT' | 'REVOKE' | 'INHERIT';
}

export class UpdateUserPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserOverrideItemDto)
  overrides!: UserOverrideItemDto[];
}
