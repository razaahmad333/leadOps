import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebsiteFormIntakeDto, WebsiteFormIntakeSchema } from '@leadops/shared';
import { Public } from '../common/decorators/public.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IntakeService } from './intake.service';

@ApiTags('intake')
@Controller('intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Public()
  @Post('website')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Public website-form lead intake endpoint' })
  intakeWebsiteForm(@Body(new ZodValidationPipe(WebsiteFormIntakeSchema)) dto: WebsiteFormIntakeDto) {
    return this.intakeService.intakeWebsiteForm(dto);
  }
}
