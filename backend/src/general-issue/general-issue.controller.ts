import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Req,
} from '@nestjs/common';
import { GeneralIssueService } from './general-issue.service.js';
import { CreateGeneralIssueDto, CancelGeneralIssueDto } from './dto/general-issue.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api/general-issue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GeneralIssueController {
  constructor(private readonly generalIssueService: GeneralIssueService) {}

  /**
   * Who can create: STORES, ADMIN
   * Approval: Direct issuance upon creation (no approval gate required)
   */
  @Post()
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async createIssue(
    @Body() dto: CreateGeneralIssueDto,
    @Req() req: any,
  ) {
    return this.generalIssueService.createIssue(dto, req.user.userId);
  }

  /**
   * Who can view: All active system roles
   */
  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async findAll() {
    return this.generalIssueService.findAll();
  }

  /**
   * Who can view single issue: All active system roles
   */
  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async findOne(@Param('id') id: string) {
    return this.generalIssueService.findOne(id);
  }

  /**
   * Reversal / Cancellation: STORES, ADMIN
   * Effects: Reverses issue status to CANCELLED and refunds stock to original bins
   */
  @Post(':id/cancel')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async cancelIssue(
    @Param('id') id: string,
    @Body() dto: CancelGeneralIssueDto,
    @Req() req: any,
  ) {
    return this.generalIssueService.cancelIssue(id, req.user.userId, dto?.remarks);
  }
}
