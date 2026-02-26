import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateFollowUpDto, CreateFollowUpSchema, TodayFollowUp } from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FollowUpsService } from './follow-ups.service';

@ApiTags('followups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('followups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Get('today')
  @ApiOperation({ summary: "Get today's pending follow-ups" })
  findToday(): Promise<TodayFollowUp[]> {
    return this.followUpsService.findToday();
  }

  @Post()
  @ApiOperation({ summary: 'Create a follow-up for a lead' })
  create(
    @Body(new ZodValidationPipe(CreateFollowUpSchema)) dto: CreateFollowUpDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.followUpsService.create(dto, user.id);
  }

  @Patch(':id/done')
  @ApiOperation({ summary: 'Mark follow-up as done' })
  markDone(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.followUpsService.markDone(id, user.id);
  }
}
