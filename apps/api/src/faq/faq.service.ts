import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AnswerFaqQuestionDto,
  AuthUser,
  CreateFaqQuestionDto,
  FaqQuestion,
  FaqQuestionListResponse,
  ListFaqQuestionsQueryDto,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { buildPaginatedResponse } from '../common/utils/pagination.util';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query: ListFaqQuestionsQueryDto): Promise<FaqQuestionListResponse> {
    const tenant = getTenantContext();
    const tenantId = tenant?.tenantId ?? user.tenantId;
    const canAnswer = user.isSuperAdmin || user.effectivePermissions.includes('faq.answer');
    const where: Prisma.FaqQuestionWhereInput = user.isSuperAdmin
      ? {}
      : { tenantId };

    if (query.status === 'open') {
      where.status = 'OPEN';
    } else if (query.status === 'answered') {
      where.status = 'ANSWERED';
    }

    if (query.search) {
      where.OR = [
        { question: { contains: query.search, mode: 'insensitive' } },
        { answer: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (!canAnswer) {
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];

      where.AND = [
        ...existingAnd,
        {
          OR: [
            { status: 'ANSWERED' },
            { askedById: user.id },
          ],
        },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.faqQuestion.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          askedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          answeredBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.faqQuestion.count({ where }),
    ]);

    return buildPaginatedResponse(items as FaqQuestion[], query.page, query.pageSize, total);
  }

  async create(user: AuthUser, dto: CreateFaqQuestionDto): Promise<FaqQuestion> {
    const tenant = getTenantContext();
    const tenantId = tenant?.tenantId ?? user.tenantId;
    const created = await this.prisma.faqQuestion.create({
      data: {
        tenantId,
        branchId: tenant?.selectedBranchId ?? null,
        askedById: user.id,
        question: dto.question,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        askedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return created as FaqQuestion;
  }

  async answer(id: string, user: AuthUser, dto: AnswerFaqQuestionDto): Promise<FaqQuestion> {
    const tenant = getTenantContext();
    const tenantId = tenant?.tenantId ?? user.tenantId;
    const existing = await this.prisma.faqQuestion.findFirst({
      where: user.isSuperAdmin
        ? { id }
        : {
            id,
            tenantId,
          },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    const updated = await this.prisma.faqQuestion.update({
      where: { id: existing.id },
      data: {
        answer: dto.answer,
        status: 'ANSWERED',
        answeredById: user.id,
        answeredAt: new Date(),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        askedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated as FaqQuestion;
  }
}
