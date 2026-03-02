import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CreateFollowUpDto, CreateFollowUpSchema, TodayFollowUp } from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FollowUpsService } from './follow-ups.service';

@ApiTags('followups')
@ApiBearerAuth()
@Controller('followups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Get('today')
  @Permissions('followups.view')
  @ApiOperation({ summary: "Get today's pending follow-ups" })
  findToday(@CurrentUser() user: AuthUser): Promise<TodayFollowUp[]> {
    return this.followUpsService.findToday(user);
  }

  @Post()
  @Permissions('followups.create')
  @ApiOperation({ summary: 'Create a follow-up for a lead' })
  create(
    @Body(new ZodValidationPipe(CreateFollowUpSchema)) dto: CreateFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.followUpsService.create(dto, user);
  }

  @Patch(':id/done')
  @Permissions('followups.complete')
  @ApiOperation({ summary: 'Mark follow-up as done' })
  markDone(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.followUpsService.markDone(id, user);
  }
}
