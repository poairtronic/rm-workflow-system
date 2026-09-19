import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RmItemMappingDto {
  @IsUUID('4')
  rmItemId!: string;

  @IsOptional()
  @IsUUID('4')
  productId?: string;
}

export class StoresReviewRmDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RmItemMappingDto)
  itemMappings!: RmItemMappingDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}
