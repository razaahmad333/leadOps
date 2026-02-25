import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateLeadSchema,
  UpdateLeadStatusSchema,
  type CreateLeadDto,
  type UpdateLeadStatusDto,
  type Lead,
} from '@leadops/shared';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List all leads for the current tenant' })
  @ApiResponse({ status: 200, description: 'Array of leads' })
  findAll(): Promise<Lead[]> {
    return this.leadsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead by ID' })
  findOne(@Param('id') id: string): Promise<Lead> {
    return this.leadsService.findOne(id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateLeadSchema))
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiResponse({ status: 201, description: 'Lead created' })
  create(@Body() dto: CreateLeadDto): Promise<Lead> {
    return this.leadsService.create(dto);
  }

  @Patch(':id/status')
  @UsePipes(new ZodValidationPipe(UpdateLeadStatusSchema))
  @ApiOperation({ summary: 'Update lead status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ): Promise<Lead> {
    return this.leadsService.updateStatus(id, dto);
  }
}
