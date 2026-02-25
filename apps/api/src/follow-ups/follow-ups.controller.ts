import { Controller, Get, Post, Patch, Body, Param, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FollowUpsService } from './follow-ups.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateFollowUpSchema, type CreateFollowUpDto } from '@leadops/shared';

@ApiTags('followups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('followups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Get('today')
  @ApiOperation({ summary: "Get today's pending follow-ups" })
  findToday() {
    return this.followUpsService.findToday();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateFollowUpSchema))
  @ApiOperation({ summary: 'Schedule a new follow-up' })
  create(@Body() dto: CreateFollowUpDto) {
    return this.followUpsService.create(dto);
  }

  @Patch(':id/done')
  @ApiOperation({ summary: 'Mark a follow-up as done' })
  markDone(@Param('id') id: string) {
    return this.followUpsService.markDone(id);
  }
}
