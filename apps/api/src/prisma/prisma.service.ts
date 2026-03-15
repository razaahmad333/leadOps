import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const ANSI = {
  reset: '\u001B[0m',
  dim: '\u001B[2m',
  cyan: '\u001B[36m',
  yellow: '\u001B[33m',
  magenta: '\u001B[35m',
  green: '\u001B[32m',
} as const;

const prismaLogConfig = [
  { emit: 'stdout', level: 'error' },
  { emit: 'stdout', level: 'warn' },
  { emit: 'event', level: 'query' },
] as const satisfies Prisma.PrismaClientOptions['log'];

type PrismaClientOptionsWithQueryEvents = Prisma.PrismaClientOptions & {
  log: typeof prismaLogConfig;
};

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaClientOptionsWithQueryEvents>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly queryLoggingEnabled =
    process.env.NODE_ENV === 'development' || process.env.PRISMA_LOG_QUERIES === 'true';

  constructor() {
    super({
      log: [...prismaLogConfig],
    });

    if (this.queryLoggingEnabled) {
      this.$on('query', (event) => {
        const params = this.formatParams(event.params);
        const durationColor = event.duration >= 1_000 ? ANSI.magenta : event.duration >= 250 ? ANSI.yellow : ANSI.green;

        this.logger.debug(
          [
            `${ANSI.cyan}[prisma:query]${ANSI.reset} ${event.query}`,
            `${ANSI.yellow}[params]${ANSI.reset} ${params}`,
            `${durationColor}[duration]${ANSI.reset} ${event.duration}ms`,
            `${ANSI.dim}[target]${ANSI.reset} ${event.target}`,
          ].join('\n'),
        );
      });
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private formatParams(raw: string): string {
    if (!raw) {
      return '[]';
    }

    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
}
