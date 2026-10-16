import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('status')
  getStatus() {
    return this.auditService.getStatus();
  }

  @Get('logs')
  @Roles(
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.SENIOR_MANAGER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
  )
  async getLogs(
    @Query('search') search?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.auditService.getLogs({
      search,
      module,
      action,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('export-csv')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER)
  async exportCsv(
    @Res() res: any,
    @Query('search') search?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
  ) {
    const csvContent = await this.auditService.exportCsv({
      search,
      module,
      action,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="v_smart_audit_logs_${Date.now()}.csv"`,
    );
    res.send(csvContent);
  }

  @Post('log')
  @Roles(UserRole.ADMIN)
  async createLog(@Body() body: any, @Req() req: any) {
    const actorId = req.user?.userId || req.user?.id;
    return await this.auditService.logEvent({
      ...body,
      actorId,
    });
  }
}
