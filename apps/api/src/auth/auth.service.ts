import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Account, Tenant, User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  AuthFlowResponse,
  AuthUser,
  LoginDto,
  LoginResponse,
  RequestLoginOtpDto,
  RequestLoginOtpResponse,
  Role,
  SelectTenantDto,
  SwitchTenantDto,
  TenantOption,
  UserStatus,
  VerifyLoginOtpDto,
} from '@leadops/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { MessageBirdVerifyService } from './messagebird-verify.service';

type AuthMembership = User & { tenant: Tenant };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly accessControl: AccessControlService,
    private readonly messageBirdVerify: MessageBirdVerifyService,
  ) {}

  async login(dto: LoginDto): Promise<AuthFlowResponse> {
    const account = await this.findAccountByIdentifier(dto.identifier);
    if (!account) {
      throw new UnauthorizedException('Invalid email, mobile number, or password');
    }

    this.ensureAccountCanLogin(account);

    const passwordMatch = await bcrypt.compare(dto.password, account.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email, mobile number, or password');
    }

    return this.buildAuthFlowForAccount(account.id);
  }

  async requestLoginOtp(dto: RequestLoginOtpDto): Promise<RequestLoginOtpResponse> {
    const account = await this.findSingleOtpAccount(dto.phone);

    return this.messageBirdVerify.requestOtp(normalizePhoneNumber(account.phone));
  }

  async loginWithOtp(dto: VerifyLoginOtpDto): Promise<AuthFlowResponse> {
    const account = await this.findSingleOtpAccount(dto.phone);

    await this.messageBirdVerify.verifyOtp(
      dto.verificationId,
      normalizePhoneNumber(account.phone),
      dto.otpCode,
    );

    return this.buildAuthFlowForAccount(account.id);
  }

  async selectTenant(dto: SelectTenantDto): Promise<LoginResponse> {
    const accountId = this.verifyTenantSelectionToken(dto.selectionToken);
    const membership = await this.findMembership(accountId, dto.tenantId);
    return this.buildLoginResponse(membership);
  }

  async switchTenant(accountId: string, dto: SwitchTenantDto): Promise<LoginResponse> {
    const membership = await this.findMembership(accountId, dto.tenantId);
    return this.buildLoginResponse(membership);
  }

  me(userId: string): Promise<AuthUser> {
    const tenantContext = getTenantContext(false);
    return this.accessControl.buildAuthUser(userId, tenantContext?.tenantId, tenantContext?.requestId);
  }

  private async buildAuthFlowForAccount(accountId: string): Promise<AuthFlowResponse> {
    const memberships = await this.findActiveMemberships(accountId);
    if (memberships.length === 0) {
      throw new UnauthorizedException('No active tenant access found for this account');
    }

    if (memberships.length === 1) {
      return this.buildLoginResponse(memberships[0]);
    }

    return {
      kind: 'tenant_selection_required',
      selectionToken: this.createTenantSelectionToken(accountId),
      tenants: memberships.map((membership) => this.mapTenantOption(membership)),
    };
  }

  private async buildLoginResponse(user: AuthMembership): Promise<LoginResponse> {
    const tenantContext = getTenantContext(false);
    const accessToken = this.jwt.sign({
      sub: user.id,
      accountId: user.accountId,
      role: user.role,
      tenantId: user.tenantId,
      email: user.email,
      kind: 'access',
    });

    const authUser = await this.accessControl.buildAuthUser(
      user.id,
      user.tenantId,
      tenantContext?.requestId,
    );

    return {
      kind: 'authenticated',
      accessToken,
      tenantName: user.tenant.name,
      user: authUser,
    };
  }

  private async findSingleOtpAccount(phone: string): Promise<Account> {
    const account = await this.findAccountByPhone(phone);
    if (!account) {
      throw new UnauthorizedException('No active account found for this mobile number');
    }

    this.ensureAccountCanLogin(account);

    const memberships = await this.findActiveMemberships(account.id);
    if (memberships.length === 0) {
      throw new UnauthorizedException('No active account found for this mobile number');
    }

    return account;
  }

  private async findAccountByIdentifier(identifier: string): Promise<Account | null> {
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) {
      return null;
    }

    const emailAccount = await this.prisma.account.findUnique({
      where: { email: normalizedIdentifier.toLowerCase() },
    });

    if (emailAccount) {
      return emailAccount;
    }

    const membership = await this.prisma.user.findFirst({
      where: {
        email: normalizedIdentifier.toLowerCase(),
      },
      include: {
        account: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (membership) {
      return membership.account;
    }

    return this.findAccountByPhone(normalizedIdentifier);
  }

  private async findAccountByPhone(phone: string): Promise<Account | null> {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return null;
    }

    return this.prisma.account.findUnique({
      where: {
        phone: normalizedPhone,
      },
    });
  }

  private async findActiveMemberships(accountId: string): Promise<AuthMembership[]> {
    return this.prisma.user.findMany({
      where: {
        accountId,
        status: UserStatus.ACTIVE,
      },
      include: {
        tenant: true,
      },
      orderBy: [{ tenant: { name: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  private async findMembership(accountId: string, tenantId: string): Promise<AuthMembership> {
    const membership = await this.prisma.user.findFirst({
      where: {
        accountId,
        tenantId,
        status: UserStatus.ACTIVE,
      },
      include: {
        tenant: true,
      },
    });

    if (!membership) {
      throw new UnauthorizedException('Tenant access not found for this account');
    }

    return membership;
  }

  private mapTenantOption(user: AuthMembership): TenantOption {
    return {
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      userId: user.id,
      role: user.role as Role,
      isSuperAdmin: user.isSuperAdmin,
      isTenantAdmin: user.isTenantAdmin,
    };
  }

  private createTenantSelectionToken(accountId: string): string {
    return this.jwt.sign(
      {
        purpose: 'tenant-selection',
        accountId,
      },
      {
        expiresIn: '15m',
      },
    );
  }

  private verifyTenantSelectionToken(token: string): string {
    try {
      const payload = this.jwt.verify<{ purpose?: string; accountId?: string }>(token);
      if (payload.purpose !== 'tenant-selection' || !payload.accountId) {
        throw new UnauthorizedException('Invalid tenant selection token');
      }

      return payload.accountId;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid tenant selection token');
    }
  }

  private ensureAccountCanLogin(account: Account): void {
    if (account.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('This account is inactive');
    }
  }
}
