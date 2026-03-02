import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  LoginDto,
  LoginSchema,
  RequestLoginOtpDto,
  RequestLoginOtpSchema,
  VerifyLoginOtpDto,
  VerifyLoginOtpSchema,
} from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a JWT' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('forgot-password/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a login OTP to the user mobile number' })
  @ApiResponse({ status: 200, description: 'OTP requested' })
  requestLoginOtp(@Body(new ZodValidationPipe(RequestLoginOtpSchema)) dto: RequestLoginOtpDto) {
    return this.authService.requestLoginOtp(dto);
  }

  @Public()
  @Post('forgot-password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an OTP and login without a password' })
  @ApiResponse({ status: 200, description: 'OTP verified and login successful' })
  verifyLoginOtp(@Body(new ZodValidationPipe(VerifyLoginOtpSchema)) dto: VerifyLoginOtpDto) {
    return this.authService.loginWithOtp(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user with effective permissions' })
  me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.authService.me(user.id);
  }
}
