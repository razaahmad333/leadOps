import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AnswerFaqQuestionDto,
  AnswerFaqQuestionSchema,
  AuthUser,
  CreateFaqQuestionDto,
  CreateFaqQuestionSchema,
  FaqQuestion,
  FaqQuestionListResponse,
  ListFaqQuestionsQueryDto,
  ListFaqQuestionsQuerySchema,
} from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FaqService } from './faq.service';

@ApiTags('faq')
@ApiBearerAuth()
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @Permissions('faq.view')
  @ApiOperation({ summary: 'List Q&A questions for the current tenant' })
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListFaqQuestionsQuerySchema)) query: ListFaqQuestionsQueryDto,
  ): Promise<FaqQuestionListResponse> {
    return this.faqService.list(user, query);
  }

  @Post()
  @Permissions('faq.ask')
  @ApiOperation({ summary: 'Submit a tenant Q&A question' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateFaqQuestionSchema)) dto: CreateFaqQuestionDto,
  ): Promise<FaqQuestion> {
    return this.faqService.create(user, dto);
  }

  @Patch(':id/answer')
  @Permissions('faq.answer')
  @ApiOperation({ summary: 'Answer a tenant Q&A question' })
  answer(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AnswerFaqQuestionSchema)) dto: AnswerFaqQuestionDto,
  ): Promise<FaqQuestion> {
    return this.faqService.answer(id, user, dto);
  }
}
