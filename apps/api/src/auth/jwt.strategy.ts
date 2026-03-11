import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@leadops/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';

interface JwtPayload {
  sub: string;
  accountId: string;
  email: string;
  role: string;
  tenantId: string;
  kind?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const tenantContext = getTenantContext(false);

    if (tenantContext?.tenantId && tenantContext.tenantId !== 'system') {
      if (payload.tenantId !== tenantContext.tenantId) {
        throw new UnauthorizedException('Token tenant does not match request tenant');
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('User is inactive');
    }

    if (payload.kind && payload.kind !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    if (payload.accountId !== user.accountId) {
      throw new UnauthorizedException('Token account does not match user');
    }

    return this.accessControl.buildAuthUser(
      user.id,
      user.tenantId,
      tenantContext?.requestId,
    );
  }
}
