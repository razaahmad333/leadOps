import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Tenant, User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  AuthUser,
  LoginDto,
  LoginResponse,
  RequestLoginOtpDto,
  RequestLoginOtpResponse,
  UserStatus,
  VerifyLoginOtpDto,
} from '@leadops/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { normalizePhoneNumber, samePhoneNumber } from '../common/utils/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { MessageBirdVerifyService } from './messagebird-verify.service';

type AuthCandidate = User & { tenant: Tenant };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly accessControl: AccessControlService,
    private readonly messageBirdVerify: MessageBirdVerifyService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const tenantContext = getTenantContext();
    const users = await this.findUsersByPhone(tenantContext?.tenantId ?? '', dto.phone);

    let matchedUser: AuthCandidate | null = null;
    for (const candidate of users) {
      const passwordMatch = await bcrypt.compare(dto.password, candidate.passwordHash);
      if (passwordMatch) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Invalid mobile number or password');
    }

    this.ensureUserCanLogin(matchedUser);
    return this.buildLoginResponse(matchedUser);
  }

  async requestLoginOtp(dto: RequestLoginOtpDto): Promise<RequestLoginOtpResponse> {
    const tenantContext = getTenantContext();
    const user = await this.findSingleOtpUser(tenantContext?.tenantId ?? '', dto.phone);

    return this.messageBirdVerify.requestOtp(normalizePhoneNumber(user.phone));
  }

  async loginWithOtp(dto: VerifyLoginOtpDto): Promise<LoginResponse> {
    const tenantContext = getTenantContext();
    const user = await this.findSingleOtpUser(tenantContext?.tenantId ?? '', dto.phone);

    await this.messageBirdVerify.verifyOtp(
      dto.verificationId,
      normalizePhoneNumber(user.phone),
      dto.otpCode,
    );

    return this.buildLoginResponse(user);
  }

  me(userId: string): Promise<AuthUser> {
    const tenantContext = getTenantContext(false);
    return this.accessControl.buildAuthUser(userId, tenantContext?.tenantId, tenantContext?.requestId);
  }

  private async buildLoginResponse(user: AuthCandidate): Promise<LoginResponse> {
    const tenantContext = getTenantContext();
    const accessToken = this.jwt.sign({
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
      email: user.email,
    });

    const authUser = await this.accessControl.buildAuthUser(
      user.id,
      user.tenantId,
      tenantContext?.requestId,
    );

    return {
      accessToken,
      tenantName: user.tenant.name,
      user: authUser,
    };
  }

  private async findSingleOtpUser(tenantId: string, phone: string): Promise<AuthCandidate> {
    const users = await this.findUsersByPhone(tenantId, phone);
    const activeUsers = users.filter((user) => user.status === UserStatus.ACTIVE);

    if (activeUsers.length === 0) {
      throw new UnauthorizedException('No active account found for this mobile number');
    }

    if (activeUsers.length > 1) {
      throw new BadRequestException('Multiple accounts use this mobile number. Contact an administrator.');
    }

    return activeUsers[0];
  }

  private async findUsersByPhone(tenantId: string, phone: string): Promise<AuthCandidate[]> {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!tenantId || !normalizedPhone) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        phone: {
          not: null,
        },
      },
      include: {
        tenant: true,
      },
    });

    return users.filter((user) => samePhoneNumber(user.phone, normalizedPhone));
  }

  private ensureUserCanLogin(user: AuthCandidate): void {
    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('This user is inactive');
    }
  }
}
