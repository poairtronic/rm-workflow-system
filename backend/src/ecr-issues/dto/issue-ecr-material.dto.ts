import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IssueEcrMaterialItemDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  binId!: string;

  @IsInt()
  @Min(1)
  quantityIssued!: number;
}

export class IssueEcrMaterialDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IssueEcrMaterialItemDto)
  items!: IssueEcrMaterialItemDto[];
}

export default IssueEcrMaterialDto;
