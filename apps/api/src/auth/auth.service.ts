import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto, LoginResponse } from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const tenantContext = getTenantContext();

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenantContext?.tenantId ?? '',
          email: dto.email,
        },
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.jwt.sign({
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
      email: user.email,
    });

    return {
      accessToken,
      tenantName: user.tenant.name,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as unknown as LoginResponse['user']['role'],
        tenantId: user.tenantId,
      },
    };
  }
}
