import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateDeliveryChallanDto } from './dto/create-delivery-challan.dto.js';
import { ReturnDeliveryChallanDto } from './dto/return-delivery-challan.dto.js';
import { QcInspectDeliveryChallanDto } from './dto/qc-inspect-delivery-challan.dto.js';
import { ReworkReDispatchDto } from './dto/rework-re-dispatch.dto.js';
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
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION)
  async getVendorCustodySummary(@Param('vendorId') vendorId: string) {
    return this.deliveryChallanService.getVendorCustodySummary(vendorId);
  }

  @Get('custody/product/:productId')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION)
  async getProductCustodyTotal(@Param('productId') productId: string) {
    return this.deliveryChallanService.getProductCustodyTotal(productId);
  }

  @Get('all-movements')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER)
  async getAllMovements() {
    return this.deliveryChallanService.getAllDcMovements();
  }

  @Get('lifecycle-report')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER)
  async getLifecycleReport(
    @Query('type') type?: string,
    @Query('vendorId') vendorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('reworkOnly') reworkOnly?: string,
    @Query('search') search?: string,
  ) {
    return this.deliveryChallanService.getComprehensiveDcLifecycleReport({
      type,
      vendorId,
      startDate,
      endDate,
      status,
      reworkOnly: reworkOnly === 'true',
      search,
    });
  }

  @Get('movements/:scId')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER)
  async getScMovements(@Param('scId', ParseUUIDPipe) scId: string) {
    return this.deliveryChallanService.getScMovements(scId);
  }

  @Get('overdue')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION)
  async getOverdueChallans() {
    return this.deliveryChallanService.getOverdueChallans();
  }

  @Post('check-sla-alerts')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  async checkSlaAlerts() {
    return this.deliveryChallanService.checkAndAlertExpectedReturnDates();
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

  @Get('next-type2-item-sequence')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER)
  async getNextType2ItemSequence() {
    const nextSequence = await this.deliveryChallanService.getNextType2ItemSequence();
    return {
      nextSequence,
      formattedCode: `DC2-${String(nextSequence).padStart(3, '0')}`,
    };
  }

  @Get('rework-items')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER)
  async getReworkItems() {
    return this.deliveryChallanService.getReworkItems();
  }

  @Patch('rework-items/:reworkId/mark-okay')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async markReworkItemOkay(@Param('reworkId', ParseUUIDPipe) reworkId: string) {
    return this.deliveryChallanService.markReworkItemOkay(reworkId);
  }

  @Post('rework-items/:reworkId/re-dispatch')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async reDispatchReworkItem(
    @Param('reworkId', ParseUUIDPipe) reworkId: string,
    @Body() dto: ReworkReDispatchDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.deliveryChallanService.reDispatchReworkItem(reworkId, dto, userId);
  }

  @Get(':id/printable')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER)
  async getPrintable(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('reworkId') reworkId?: string,
    @Query('view') view?: string,
  ) {
    return this.deliveryChallanService.getPrintableChallanData(id, reworkId, view);
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

  @Patch(':id/dock-return')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async dockReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnDeliveryChallanDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.deliveryChallanService.processChallanReturn(id, dto, userId);
  }

  @Post(':id/qc-inspect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async qcInspect(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QcInspectDeliveryChallanDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.deliveryChallanService.qcInspectChallan(id, dto, userId);
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
