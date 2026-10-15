import { Controller, Get, Param, ParseUUIDPipe, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@ApiTags('Reports & Analytics')
@Controller('api/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('process-wise')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getProcessWise() {
    return this.reportsService.getProcessWiseReport();
  }

  @Get('item-wise')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getItemWise() {
    return this.reportsService.getItemWiseReport();
  }

  @Get('rm-consumption')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getRmConsumption() {
    return this.reportsService.getRmConsumptionReport();
  }

  @ApiOperation({ summary: 'Export Consolidated SC & PO Traceability Multi-Tab Excel Workbook' })
  @ApiResponse({ status: 200, description: 'Streams .xlsx workbook or returns signed Supabase URL' })
  @Get('export/excel/traceability')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async exportTraceabilityExcel(
    @Query('archive') archive: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const shouldArchive = archive === 'true' || archive === '1';
    const userId = req.user?.userId || req.user?.sub || 'SYSTEM';
    const result = await this.reportsService.getTraceabilityExcel(shouldArchive, userId);

    if (shouldArchive && result.downloadUrl) {
      return res.json({
        success: true,
        filename: result.filename,
        downloadUrl: result.downloadUrl,
        storageKey: result.storageKey,
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return res.send(result.buffer);
  }

  @ApiOperation({ summary: 'Export Stock Movement & Balances Multi-Tab Excel Workbook' })
  @ApiResponse({ status: 200, description: 'Streams .xlsx workbook or returns signed Supabase URL' })
  @Get('export/excel/stock-movement')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.STORES)
  async exportStockMovementExcel(
    @Query('archive') archive: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const shouldArchive = archive === 'true' || archive === '1';
    const userId = req.user?.userId || req.user?.sub || 'SYSTEM';
    const result = await this.reportsService.getStockMovementExcel(shouldArchive, userId);

    if (shouldArchive && result.downloadUrl) {
      return res.json({
        success: true,
        filename: result.filename,
        downloadUrl: result.downloadUrl,
        storageKey: result.storageKey,
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return res.send(result.buffer);
  }

  @ApiOperation({ summary: 'Export Vendor SLA & Delivery Challan Tracker Multi-Tab Excel Workbook' })
  @ApiResponse({ status: 200, description: 'Streams .xlsx workbook or returns signed Supabase URL' })
  @Get('export/excel/vendor-sla')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async exportVendorSlaExcel(
    @Query('archive') archive: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const shouldArchive = archive === 'true' || archive === '1';
    const userId = req.user?.userId || req.user?.sub || 'SYSTEM';
    const result = await this.reportsService.getVendorSlaExcel(shouldArchive, userId);

    if (shouldArchive && result.downloadUrl) {
      return res.json({
        success: true,
        filename: result.filename,
        downloadUrl: result.downloadUrl,
        storageKey: result.storageKey,
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return res.send(result.buffer);
  }

  @ApiOperation({ summary: 'Export Delivery Challan as Vector PDF' })
  @ApiResponse({ status: 200, description: 'Streams .pdf document or returns signed Supabase URL' })
  @Get('export/pdf/delivery-challan/:id')
  @Roles(UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async exportDeliveryChallanPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('archive') archive: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const shouldArchive = archive === 'true' || archive === '1';
    const userId = req.user?.userId || req.user?.sub || 'SYSTEM';
    const result = await this.reportsService.getDeliveryChallanPdf(id, shouldArchive, userId);

    if (shouldArchive && result.downloadUrl) {
      return res.json({
        success: true,
        filename: result.filename,
        downloadUrl: result.downloadUrl,
        storageKey: result.storageKey,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    return res.send(result.buffer);
  }

  @ApiOperation({ summary: 'Export Material Issue Slip as Vector PDF' })
  @ApiResponse({ status: 200, description: 'Streams .pdf document or returns signed Supabase URL' })
  @Get('export/pdf/material-issue/:id')
  @Roles(UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async exportMaterialIssueSlipPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('archive') archive: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const shouldArchive = archive === 'true' || archive === '1';
    const userId = req.user?.userId || req.user?.sub || 'SYSTEM';
    const result = await this.reportsService.getMaterialIssueSlipPdf(id, shouldArchive, userId);

    if (shouldArchive && result.downloadUrl) {
      return res.json({
        success: true,
        filename: result.filename,
        downloadUrl: result.downloadUrl,
        storageKey: result.storageKey,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    return res.send(result.buffer);
  }
}

