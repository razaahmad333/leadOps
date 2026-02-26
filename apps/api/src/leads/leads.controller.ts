import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateLeadDto,
  CreateLeadNoteDto,
  CreateLeadNoteSchema,
  CreateLeadSchema,
  Lead,
  LeadDetail,
  UpdateLeadStatusDto,
  UpdateLeadStatusSchema,
} from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads for the current tenant' })
  findAll(): Promise<Lead[]> {
    return this.leadsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead details and activity timeline' })
  findOne(@Param('id') id: string): Promise<LeadDetail> {
    return this.leadsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a lead with mandatory next follow-up' })
  @ApiResponse({ status: 201, description: 'Lead created' })
  create(
    @Body(new ZodValidationPipe(CreateLeadSchema)) dto: CreateLeadDto,
    @CurrentUser() user: { id: string },
  ): Promise<Lead> {
    return this.leadsService.create(dto, {
      actorId: user.id,
      activityType: 'lead.created.manual',
      activityMessage: 'Lead manually created',
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update lead status' })
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadStatusSchema)) dto: UpdateLeadStatusDto,
    @CurrentUser() user: { id: string },
  ): Promise<Lead> {
    return this.leadsService.updateStatus(id, dto, user.id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a note to the lead activity timeline' })
  async addNote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateLeadNoteSchema)) dto: CreateLeadNoteDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ success: boolean }> {
    await this.leadsService.addNote(id, dto.note, user.id);
    return { success: true };
  }
}
