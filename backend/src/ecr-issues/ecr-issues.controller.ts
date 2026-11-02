import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EcrIssuesService } from './ecr-issues.service.js';
import { InternalSecretGuard } from './guards/internal-secret.guard.js';
import { ReceiveEcrPendingDto } from './dto/receive-ecr-pending.dto.js';
import { IssueEcrMaterialDto } from './dto/issue-ecr-material.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api')
export class EcrIssuesController {
  constructor(private readonly ecrIssuesService: EcrIssuesService) {}

  @Post('internal/ecr/material-pending')
  @UseGuards(InternalSecretGuard)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async receivePending(@Body() dto: ReceiveEcrPendingDto) {
    return this.ecrIssuesService.receivePending(dto);
  }

  @Get('ecr-issues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async getAll() {
    return this.ecrIssuesService.getAll();
  }

  @Get('ecr-issues/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async getOne(@Param('id') id: string) {
    return this.ecrIssuesService.getOne(id);
  }

  @Post('ecr-issues/:id/issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async issue(
    @Param('id') id: string,
    @Body() dto: IssueEcrMaterialDto,
    @Req() req: any,
  ) {
    const user = req.user;
    const currentUser = {
      id: user?.userId || user?.id || user?.sub,
      name: user?.name,
      email: user?.email,
      role: user?.role,
    };
    return this.ecrIssuesService.issue(id, dto, currentUser);
  }
}

export default EcrIssuesController;
