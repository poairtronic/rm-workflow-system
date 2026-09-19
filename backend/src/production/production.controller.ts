import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductionService } from './production.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import {
  CreateProductionReceiptDto,
  CreateMaterialConsumptionDto,
  CreateMaterialReturnDto,
  VerifyReturnDto,
} from './dto/production.dto.js';

@Controller('api/production')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('receipt')
  @Roles(UserRole.PRODUCTION, UserRole.ADMIN)
  receiveMaterial(@Body() dto: CreateProductionReceiptDto, @Req() req: any) {
    return this.productionService.receiveMaterial(dto, req.user.userId);
  }

  @Post('consume')
  @Roles(UserRole.PRODUCTION, UserRole.ADMIN)
  recordConsumption(
    @Body() dto: CreateMaterialConsumptionDto,
    @Req() req: any,
  ) {
    return this.productionService.recordConsumption(dto, req.user.userId);
  }

  @Post('return')
  @Roles(UserRole.PRODUCTION, UserRole.ADMIN)
  recordReturn(@Body() dto: CreateMaterialReturnDto, @Req() req: any) {
    return this.productionService.recordReturn(dto, req.user.userId);
  }

  @Post('return/:id/verify')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  verifyReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyReturnDto,
    @Req() req: any,
  ) {
    return this.productionService.verifyReturn(id, dto, req.user.userId);
  }

  @Get('accounting/:scId')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  getAccounting(@Param('scId', ParseUUIDPipe) scId: string) {
    return this.productionService.getAccounting(scId);
  }
}
