import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
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
  LeadListResponse,
  LeadDetail,
  ListLeadsQueryDto,
  ListLeadsQuerySchema,
  AuthUser,
  UpdateLeadStatusDto,
  UpdateLeadStatusSchema,
} from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LeadsService } from './leads.service';

interface ReplyHeaders {
  header(name: string, value: string): unknown;
}

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @Permissions('enquiries.view')
  @ApiOperation({ summary: 'List leads for the current tenant' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListLeadsQuerySchema)) query: ListLeadsQueryDto,
  ): Promise<LeadListResponse> {
    return this.leadsService.findAll(user, query);
  }

  @Get('export')
  @Permissions('enquiries.view')
  @ApiOperation({ summary: 'Export filtered leads as CSV' })
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListLeadsQuerySchema)) query: ListLeadsQueryDto,
    @Res({ passthrough: true }) response: ReplyHeaders,
  ): Promise<string> {
    response.header('Content-Type', 'text/csv; charset=utf-8');
    response.header('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    return this.leadsService.exportCsv(user, query);
  }

  @Get(':id')
  @Permissions('enquiries.view')
  @ApiOperation({ summary: 'Get lead details and activity timeline' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser): Promise<LeadDetail> {
    return this.leadsService.findOne(id, user);
  }

  @Post()
  @Permissions('enquiries.create')
  @ApiOperation({ summary: 'Create a lead with mandatory next follow-up' })
  @ApiResponse({ status: 201, description: 'Lead created' })
  create(
    @Body(new ZodValidationPipe(CreateLeadSchema)) dto: CreateLeadDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Lead> {
    return this.leadsService.create(dto, {
      actor: user,
      activityType: 'lead.created.manual',
      activityMessage: 'Lead manually created',
    });
  }

  @Patch(':id/status')
  @Permissions('enquiries.edit')
  @ApiOperation({ summary: 'Update lead status' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateLeadStatusSchema)) dto: UpdateLeadStatusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Lead> {
    return this.leadsService.updateStatus(id, dto, user);
  }

  @Post(':id/notes')
  @Permissions('enquiries.edit')
  @ApiOperation({ summary: 'Add a note to the lead activity timeline' })
  async addNote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateLeadNoteSchema)) dto: CreateLeadNoteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    await this.leadsService.addNote(id, dto.note, user);
    return { success: true };
  }
}
