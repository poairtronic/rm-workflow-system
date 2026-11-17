import { IsBoolean, IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRoleEventSettingDto {
  @IsBoolean()
  enabled!: boolean;
}

export class RoleEventChangeItemDto {
  @IsString()
  @IsNotEmpty()
  eventCode!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class BulkUpdateRoleEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleEventChangeItemDto)
  changes!: RoleEventChangeItemDto[];
}
