import { Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import {
  FollowupRules,
  IndustryPreset,
  LeadStatus,
  MilestoneKey,
  PipelineStage,
  TenantDisplayConfig,
  TenantDisplayConfigSchema,
  TenantProfile,
  TenantSettings,
} from '@leadops/shared';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from './tenant.store';
import { getPresetDisplayConfig } from './tenant-presets';

interface CachedProfile {
  expiresAt: number;
  value: TenantProfile;
}

@Injectable()
export class TenantConfigService {
  private readonly cache = new Map<string, CachedProfile>();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async getTenantProfile(tenantId?: string): Promise<TenantProfile> {
    const id = tenantId ?? getTenantContext()?.tenantId;

    if (!id || id === 'system') {
      return {
        tenantId: 'system',
        tenantName: 'System',
        tenantSlug: 'system',
        configVersion: 1,
        industryPreset: IndustryPreset.GENERIC,
        displayConfig: getPresetDisplayConfig(IndustryPreset.GENERIC),
      };
    }

    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { config: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const configRecord =
      tenant.config ??
      (await this.prisma.tenantConfig.create({
        data: {
          tenantId: tenant.id,
          industryPreset: IndustryPreset.GENERIC,
          configVersion: 1,
          displayConfig: getPresetDisplayConfig(IndustryPreset.GENERIC),
          timezone: 'Asia/Jakarta',
          businessStart: '09:00',
          businessEnd: '18:00',
          stages: ['New', 'Contacted', 'Qualified', 'Pending', 'Won', 'Lost'],
          reminderRules: {
            firstReminderMinutes: 30,
            escalationMinutes: 120,
          },
          templates: [],
          featureFlags: {
            aiAssist: true,
          },
        },
      }));

    const industryPreset = this.parseIndustryPreset(configRecord.industryPreset);
    const mergedDisplayConfig = this.mergeDisplayConfig(industryPreset, configRecord.displayConfig);

    await this.persistDisplayConfigIfNeeded(
      tenant,
      configRecord.displayConfig,
      mergedDisplayConfig,
      industryPreset,
      configRecord.configVersion,
      configRecord.timezone,
      configRecord.businessStart,
      configRecord.businessEnd,
    );

    const profile: TenantProfile = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      configVersion: configRecord.configVersion,
      industryPreset,
      displayConfig: mergedDisplayConfig,
    };

    this.cache.set(id, {
      expiresAt: Date.now() + this.ttlMs,
      value: profile,
    });

    return profile;
  }

  async getDisplayConfig(tenantId?: string): Promise<TenantDisplayConfig> {
    const profile = await this.getTenantProfile(tenantId);
    return profile.displayConfig;
  }

  async getFollowupRules(tenantId?: string): Promise<FollowupRules> {
    const profile = await this.getTenantProfile(tenantId);
    return profile.displayConfig.followupRules;
  }

  async getSettings(tenantId?: string): Promise<TenantSettings> {
    const id = tenantId ?? getTenantContext()?.tenantId;
    const profile = await this.getTenantProfile(tenantId);
    const configRecord =
      id && id !== 'system'
        ? await this.prisma.tenantConfig.findUnique({ where: { tenantId: id } })
        : null;

    return {
      timezone: configRecord?.timezone ?? 'Asia/Jakarta',
      businessStart: configRecord?.businessStart ?? '09:00',
      businessEnd: configRecord?.businessEnd ?? '18:00',
      stages: profile.displayConfig.pipelineConfig.stages.map((stage) => stage.label),
      reminderRules: {
        firstReminderMinutes: profile.displayConfig.followupRules.firstReminderMinutes,
        escalationMinutes: profile.displayConfig.followupRules.escalationMinutes,
      },
      templates:
        configRecord && Array.isArray(configRecord.templates)
          ? (configRecord.templates as TenantSettings['templates'])
          : [],
      featureFlags: profile.displayConfig.featureFlags,
    };
  }

  async getDefaultStage(tenantId?: string): Promise<PipelineStage> {
    const config = await this.getDisplayConfig(tenantId);
    const stages = [...config.pipelineConfig.stages].sort((a, b) => a.order - b.order);
    return stages[0];
  }

  async resolveStage(stageKey: string, tenantId?: string): Promise<PipelineStage | null> {
    const config = await this.getDisplayConfig(tenantId);
    return config.pipelineConfig.stages.find((stage) => stage.key === stageKey) ?? null;
  }

  async canTransition(fromStageKey: string | null | undefined, toStageKey: string, tenantId?: string): Promise<boolean> {
    if (!fromStageKey || fromStageKey === toStageKey) {
      return true;
    }

    const from = await this.resolveStage(fromStageKey, tenantId);
    if (!from) {
      return true;
    }

    return from.allowedNext.includes(toStageKey);
  }

  async getStageInternalStatus(stageKey: string, tenantId?: string): Promise<LeadStatus | null> {
    const stage = await this.resolveStage(stageKey, tenantId);
    return stage?.internalStatus ?? null;
  }

  async getStageMilestone(stageKey: string, tenantId?: string): Promise<MilestoneKey | null> {
    const stage = await this.resolveStage(stageKey, tenantId);
    return stage?.milestone ?? null;
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

  private parseIndustryPreset(value: string): IndustryPreset {
    if (value === IndustryPreset.DIAGNOSTICS_LAB) {
      return IndustryPreset.DIAGNOSTICS_LAB;
    }

    return IndustryPreset.GENERIC;
  }

  private mergeDisplayConfig(
    preset: IndustryPreset,
    overrideConfig: unknown,
  ): TenantDisplayConfig {
    const base = getPresetDisplayConfig(preset);

    if (!overrideConfig || typeof overrideConfig !== 'object') {
      return base;
    }

    const merged = this.deepMerge(base, overrideConfig as Record<string, unknown>);
    const parsed = TenantDisplayConfigSchema.safeParse(merged);

    if (!parsed.success) {
      return base;
    }

    return parsed.data;
  }

  private deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
    const output: Record<string, unknown> = { ...target };

    for (const [key, sourceValue] of Object.entries(source)) {
      if (sourceValue === undefined) {
        continue;
      }

      const targetValue = output[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        output[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        );
      } else {
        output[key] = sourceValue;
      }
    }

    return output as T;
  }

  private async persistDisplayConfigIfNeeded(
    tenant: Tenant & { config: { id: string } | null },
    rawDisplayConfig: unknown,
    mergedDisplayConfig: TenantDisplayConfig,
    industryPreset: IndustryPreset,
    configVersion: number,
    timezone: string,
    businessStart: string,
    businessEnd: string,
  ): Promise<void> {
    const stored = rawDisplayConfig ? JSON.stringify(rawDisplayConfig) : null;
    const merged = JSON.stringify(mergedDisplayConfig);

    if (stored === merged && tenant.config) {
      return;
    }

    await this.prisma.tenantConfig.upsert({
      where: { tenantId: tenant.id },
      update: {
        industryPreset,
        displayConfig: mergedDisplayConfig,
        configVersion,
        timezone,
        businessStart,
        businessEnd,
        stages: mergedDisplayConfig.pipelineConfig.stages.map((stage) => stage.label),
        reminderRules: {
          firstReminderMinutes: mergedDisplayConfig.followupRules.firstReminderMinutes,
          escalationMinutes: mergedDisplayConfig.followupRules.escalationMinutes,
          postReportFollowupDays: mergedDisplayConfig.followupRules.postReportFollowupDays,
        },
        featureFlags: mergedDisplayConfig.featureFlags,
      },
      create: {
        tenantId: tenant.id,
        industryPreset,
        displayConfig: mergedDisplayConfig,
        configVersion,
        timezone,
        businessStart,
        businessEnd,
        stages: mergedDisplayConfig.pipelineConfig.stages.map((stage) => stage.label),
        reminderRules: {
          firstReminderMinutes: mergedDisplayConfig.followupRules.firstReminderMinutes,
          escalationMinutes: mergedDisplayConfig.followupRules.escalationMinutes,
          postReportFollowupDays: mergedDisplayConfig.followupRules.postReportFollowupDays,
        },
        templates: [],
        featureFlags: mergedDisplayConfig.featureFlags,
      },
    });
  }

  private parseTime(value: string): [number, number] {
    const [hours, minutes] = value.split(':').map((part) => parseInt(part, 10));
    return [Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0];
  }
}
