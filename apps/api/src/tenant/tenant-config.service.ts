import { Injectable } from '@nestjs/common';
import { TenantConfig } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { getTenantContext } from './tenant.store';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSettings } from '@leadops/shared';

interface CacheEntry {
  expiresAt: number;
  value: TenantConfig;
}

const DEFAULT_SETTINGS: TenantSettings = {
  timezone: 'Asia/Jakarta',
  businessStart: '09:00',
  businessEnd: '18:00',
  stages: ['New', 'Contacted', 'Qualified', 'Pending', 'Won', 'Lost'],
  reminderRules: {
    firstReminderMinutes: 30,
    escalationMinutes: 120,
  },
  templates: [
    {
      key: 'initial_followup',
      title: 'Initial Follow-up',
      body: 'Assalamualaikum, following up on your interest in our services.',
    },
  ],
  featureFlags: {
    aiAssist: true,
  },
};

@Injectable()
export class TenantConfigService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId?: string): Promise<TenantSettings> {
    const id = tenantId ?? getTenantContext()?.tenantId;
    if (!id || id === 'system') {
      return DEFAULT_SETTINGS;
    }

    const config = await this.getConfigRecord(id);
    return this.toSettings(config);
  }

  async normalizeToBusinessWindow(value: Date, tenantId?: string): Promise<Date> {
    const settings = await this.getSettings(tenantId);
    const timezone = settings.timezone;
    const zoned = toZonedTime(value, timezone);

    const [startHour, startMinute] = this.parseTime(settings.businessStart);
    const [endHour, endMinute] = this.parseTime(settings.businessEnd);

    const start = new Date(zoned);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(zoned);
    end.setHours(endHour, endMinute, 0, 0);

    let normalized = new Date(zoned);

    if (zoned < start) {
      normalized = start;
    }

    if (zoned >= end) {
      normalized = new Date(start);
      normalized.setDate(normalized.getDate() + 1);
    }

    return fromZonedTime(normalized, timezone);
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async getConfigRecord(tenantId: string): Promise<TenantConfig> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    let config = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });

    if (!config) {
      config = await this.prisma.tenantConfig.create({
        data: {
          tenantId,
          timezone: DEFAULT_SETTINGS.timezone,
          businessStart: DEFAULT_SETTINGS.businessStart,
          businessEnd: DEFAULT_SETTINGS.businessEnd,
          stages: DEFAULT_SETTINGS.stages,
          reminderRules: DEFAULT_SETTINGS.reminderRules,
          templates: DEFAULT_SETTINGS.templates,
          featureFlags: DEFAULT_SETTINGS.featureFlags,
        },
      });
    }

    this.cache.set(tenantId, {
      expiresAt: Date.now() + this.ttlMs,
      value: config,
    });

    return config;
  }

  private toSettings(config: TenantConfig): TenantSettings {
    return {
      timezone: config.timezone,
      businessStart: config.businessStart,
      businessEnd: config.businessEnd,
      stages: Array.isArray(config.stages) ? (config.stages as string[]) : DEFAULT_SETTINGS.stages,
      reminderRules:
        typeof config.reminderRules === 'object' && config.reminderRules
          ? (config.reminderRules as TenantSettings['reminderRules'])
          : DEFAULT_SETTINGS.reminderRules,
      templates:
        Array.isArray(config.templates)
          ? (config.templates as TenantSettings['templates'])
          : DEFAULT_SETTINGS.templates,
      featureFlags:
        typeof config.featureFlags === 'object' && config.featureFlags
          ? (config.featureFlags as TenantSettings['featureFlags'])
          : DEFAULT_SETTINGS.featureFlags,
    };
  }

  private parseTime(value: string): [number, number] {
    const [hours, minutes] = value.split(':').map((part) => parseInt(part, 10));
    return [Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0];
  }
}
