import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ReworkService } from './rework.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SubmitReworkDto } from './dto/submit-rework.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('api/rework')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReworkController {
  constructor(private readonly reworkService: ReworkService) {}

  @Get('sc-list')
  getScList() {
    return this.reworkService.getReworkScList();
  }

  @Post('submit')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async submitRework(
    @Body() dto: SubmitReworkDto,
    @CurrentUser() user: any,
  ) {
    return this.reworkService.submitToEcr(dto, user.name);
  }
}
