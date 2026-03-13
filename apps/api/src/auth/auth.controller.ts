import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthFlowResponse,
  AuthUser,
  LoginDto,
  LoginSchema,
  RequestLoginOtpDto,
  RequestLoginOtpSchema,
  SelectTenantDto,
  SelectTenantSchema,
  SwitchTenantDto,
  SwitchTenantSchema,
  VerifyLoginOtpDto,
  VerifyLoginOtpSchema,
} from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email or mobile number and receive a JWT' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto): Promise<AuthFlowResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('forgot-password/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a login OTP to the user mobile number' })
  @ApiResponse({ status: 200, description: 'OTP requested' })
  requestLoginOtp(@Body(new ZodValidationPipe(RequestLoginOtpSchema)) dto: RequestLoginOtpDto) {
    return this.authService.requestLoginOtp(dto);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('forgot-password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an OTP and login without a password' })
  @ApiResponse({ status: 200, description: 'OTP verified and login successful' })
  verifyLoginOtp(@Body(new ZodValidationPipe(VerifyLoginOtpSchema)) dto: VerifyLoginOtpDto): Promise<AuthFlowResponse> {
    return this.authService.loginWithOtp(dto);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a tenant selection token for a tenant-scoped session' })
  selectTenant(@Body(new ZodValidationPipe(SelectTenantSchema)) dto: SelectTenantDto) {
    return this.authService.selectTenant(dto);
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch the authenticated account into another tenant membership' })
  switchTenant(
    @CurrentUser() user: { accountId: string },
    @Body(new ZodValidationPipe(SwitchTenantSchema)) dto: SwitchTenantDto,
  ) {
    return this.authService.switchTenant(user.accountId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user with effective permissions' })
  me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.authService.me(user.id);
  }
}
