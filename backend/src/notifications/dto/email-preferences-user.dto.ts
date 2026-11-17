import { IsEnum, IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export type UserOverrideState = 'INHERIT' | 'ON' | 'OFF';

export class UpdateUserEventOverrideDto {
  @IsEnum(['INHERIT', 'ON', 'OFF'], {
    message: 'state must be one of: INHERIT, ON, OFF',
  })
  state!: UserOverrideState;
}

export class UserOverrideChangeItemDto {
  @IsString()
  @IsNotEmpty()
  eventCode!: string;

  @IsEnum(['INHERIT', 'ON', 'OFF'], {
    message: 'state must be one of: INHERIT, ON, OFF',
  })
  state!: UserOverrideState;
}

export class BulkUpdateUserOverridesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserOverrideChangeItemDto)
  changes!: UserOverrideChangeItemDto[];
}
