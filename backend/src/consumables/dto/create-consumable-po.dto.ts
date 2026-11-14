import { IsNotEmpty, IsString, IsArray, IsUUID } from 'class-validator';

export class CreateConsumablePoDto {
  @IsNotEmpty()
  @IsString()
  prNumber: string;

  @IsArray()
  @IsUUID('4', { each: true })
  itemIds: string[];
}
