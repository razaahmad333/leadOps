import { BadRequestException, Injectable } from '@nestjs/common';
import { Account } from '@prisma/client';
import { UserStatus } from '@leadops/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

interface FindOrCreateAccountInput {
  email: string;
  phone: string | null;
  password?: string;
  requirePasswordForNew?: boolean;
  rejectPhoneLinkedToDifferentEmail?: boolean;
  missingPasswordMessage?: string;
}

@Injectable()
export class AccountIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateAccount(input: FindOrCreateAccountInput): Promise<Account> {
    const emailAccount = await this.prisma.account.findUnique({
      where: { email: input.email },
    });
    const phoneAccount = input.phone
      ? await this.prisma.account.findUnique({
          where: { phone: input.phone },
        })
      : null;

    if (emailAccount && phoneAccount && emailAccount.id !== phoneAccount.id) {
      throw new BadRequestException('Email and mobile number belong to different accounts');
    }

    const account = emailAccount ?? phoneAccount;
    if (account) {
      if (
        input.rejectPhoneLinkedToDifferentEmail
        && emailAccount === null
        && account.email !== input.email
      ) {
        throw new BadRequestException('This mobile number is already linked to a different email');
      }

      if (input.phone && account.phone && account.phone !== input.phone) {
        throw new BadRequestException('This email is already linked to a different mobile number');
      }

      if (!account.phone && input.phone) {
        return this.prisma.account.update({
          where: { id: account.id },
          data: { phone: input.phone },
        });
      }

      return account;
    }

    if (input.requirePasswordForNew && !input.password) {
      throw new BadRequestException(
        input.missingPasswordMessage ?? 'Password is required when creating a new account',
      );
    }

    if (!input.password) {
      throw new BadRequestException('Password is required when creating a new account');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.account.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async resetPassword(accountId: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.account.update({
      where: { id: accountId },
      data: { passwordHash },
    });
  }
}
