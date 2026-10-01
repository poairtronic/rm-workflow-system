import { PartialType } from '@nestjs/mapped-types';
import { CreateProductionProcessDto } from './create-production-process.dto.js';

export class UpdateProductionProcessDto extends PartialType(CreateProductionProcessDto) {}
