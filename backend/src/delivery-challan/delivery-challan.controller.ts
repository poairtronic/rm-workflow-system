import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateDeliveryChallanDto } from './dto/create-delivery-challan.dto.js';
import { ReturnDeliveryChallanDto } from './dto/return-delivery-challan.dto.js';
import { DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api/delivery-challans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryChallanController {
  constructor(private readonly deliveryChallanService: DeliveryChallanService) {}

  @Post('type-1')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async createType1(@Body() dto: CreateDeliveryChallanDto, @Request() req: any) {
    const userId = req.user.userId;
    return this.deliveryChallanService.createType1Challan(dto, userId);
  }
  @Post('type-2')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async createType2(@Body() dto: CreateDeliveryChallanDto, @Request() req: any) {
    const userId = req.user.userId;
    return this.deliveryChallanService.createType2Challan(dto, userId);
  }
  @Get('custody/vendor/:vendorId')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER)
  async getVendorCustodySummary(@Param('vendorId') vendorId: string) {
    return this.deliveryChallanService.getVendorCustodySummary(vendorId);
  }

  @Get('custody/product/:productId')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER)
  async getProductCustodyTotal(@Param('productId') productId: string) {
    return this.deliveryChallanService.getProductCustodyTotal(productId);
  }

  @Get('overdue')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER)
  async getOverdueChallans() {
    return this.deliveryChallanService.getOverdueChallans();
  }

  @Get()
  async findAll(
    @Query('scId') scId?: string,
    @Query('processId') processId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('type') type?: DeliveryChallanType,
    @Query('isOverdue') isOverdue?: string,
    @Query('status') status?: DeliveryChallanStatus,
  ) {
    const isOverdueBool = isOverdue === 'true';
    return this.deliveryChallanService.findAll({ scId, processId, vendorId, type, isOverdue: isOverdueBool, status });
  }

  @Get(':id/printable')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION)
  async getPrintable(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveryChallanService.getPrintableChallanData(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.deliveryChallanService.findOne(id);
  }

  @Post(':id/return')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async returnChallan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnDeliveryChallanDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.deliveryChallanService.processChallanReturn(id, dto, userId);
  }

  @Patch(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async closeChallan(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.deliveryChallanService.closeChallan(id, userId);
  }
}
