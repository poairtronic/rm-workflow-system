import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryItemDto } from './create-inventory-item.dto.js';

export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {}
