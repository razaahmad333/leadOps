import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import {
  CustomEnquiryField,
  FollowupRules,
  IndustryPreset,
  LeadStatus,
  MilestoneKey,
  PipelineStage,
  TenantDisplayConfig,
  TenantDisplayConfigSchema,
  TenantIntakeConfig,
  TenantProfile,
  TenantSettings,
  TestPackage,
  UpdateTenantIntakeConfigDto,
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

  async getIntakeConfig(tenantId?: string): Promise<TenantIntakeConfig> {
    const profile = await this.getTenantProfile(tenantId);

    return {
      customEnquiryFields: profile.displayConfig.customEnquiryFields,
      testPackages: profile.displayConfig.testPackages,
    };
  }

  async updateIntakeConfig(
    input: UpdateTenantIntakeConfigDto,
    tenantId?: string,
  ): Promise<TenantIntakeConfig> {
    const profile = await this.getTenantProfile(tenantId);

    const normalizedCustomFields = this.normalizeCustomEnquiryFields(input.customEnquiryFields);
    const normalizedTestPackages = this.normalizeTestPackages(input.testPackages);

    this.validateCustomFieldCollisions(profile.displayConfig, normalizedCustomFields);
    this.validateRequiredTestPackageAvailability(profile.displayConfig, normalizedTestPackages);

    const nextDisplayConfig = this.applyDerivedIntakeConfig({
      ...profile.displayConfig,
      customEnquiryFields: normalizedCustomFields,
      testPackages: normalizedTestPackages,
    });

    await this.persistTenantDisplayConfig({
      tenantId: profile.tenantId,
      displayConfig: nextDisplayConfig,
      industryPreset: profile.industryPreset,
    });

    this.invalidate(profile.tenantId);

    return {
      customEnquiryFields: nextDisplayConfig.customEnquiryFields,
      testPackages: nextDisplayConfig.testPackages,
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
      return this.applyDerivedIntakeConfig(base);
    }

    const merged = this.deepMerge(base, overrideConfig as Record<string, unknown>);
    const parsed = TenantDisplayConfigSchema.safeParse(merged);

    if (!parsed.success) {
      return this.applyDerivedIntakeConfig(base);
    }

    return this.applyDerivedIntakeConfig(parsed.data);
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

  private async persistTenantDisplayConfig(input: {
    tenantId: string;
    displayConfig: TenantDisplayConfig;
    industryPreset: IndustryPreset;
  }): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      include: { config: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const configVersion = tenant.config?.configVersion ?? 1;
    const timezone = tenant.config?.timezone ?? 'Asia/Jakarta';
    const businessStart = tenant.config?.businessStart ?? '09:00';
    const businessEnd = tenant.config?.businessEnd ?? '18:00';

    await this.persistDisplayConfigIfNeeded(
      tenant,
      tenant.config?.displayConfig,
      input.displayConfig,
      input.industryPreset,
      configVersion,
      timezone,
      businessStart,
      businessEnd,
    );
  }

  private applyDerivedIntakeConfig(config: TenantDisplayConfig): TenantDisplayConfig {
    const normalizedCustomFields = this.normalizeCustomEnquiryFields(config.customEnquiryFields);
    const normalizedTestPackages = this.normalizeTestPackages(
      this.resolveTestPackages(config.testPackages, config.leadFieldsConfig.fields),
    );
    const customFieldKeys = new Set(normalizedCustomFields.map((field) => field.key));

    const baseFields = config.leadFieldsConfig.fields.filter((field) => !customFieldKeys.has(field.key));
    const testFieldIndex = baseFields.findIndex(
      (field) => field.key === 'testOrPackage' && field.type === 'select',
    );

    if (testFieldIndex >= 0) {
      const enabledTestPackages = normalizedTestPackages
        .filter((pkg) => pkg.enabled)
        .map((pkg) => pkg.name.trim())
        .filter((name) => name.length > 0);

      if (enabledTestPackages.length > 0 || normalizedTestPackages.length > 0) {
        baseFields[testFieldIndex] = {
          ...baseFields[testFieldIndex],
          options: enabledTestPackages,
        };
      }
    }

    return {
      ...config,
      customEnquiryFields: normalizedCustomFields,
      testPackages: normalizedTestPackages,
      leadFieldsConfig: {
        ...config.leadFieldsConfig,
        fields: [...baseFields, ...normalizedCustomFields],
      },
    };
  }

  private resolveTestPackages(
    configuredPackages: TestPackage[],
    leadFields: TenantDisplayConfig['leadFieldsConfig']['fields'],
  ): TestPackage[] {
    if (configuredPackages.length > 0) {
      return configuredPackages;
    }

    const testField = leadFields.find((field) => field.key === 'testOrPackage' && field.type === 'select');
    if (!testField?.options?.length) {
      return [];
    }

    return testField.options.map((option, index) => ({
      id: this.slugify(option) || `test-package-${index + 1}`,
      name: option,
      description: '',
      enabled: true,
    }));
  }

  private normalizeCustomEnquiryFields(fields: CustomEnquiryField[]): CustomEnquiryField[] {
    const seenKeys = new Set<string>();

    return fields.map((field, index) => {
      const key = field.key.trim();

      if (!key || seenKeys.has(key)) {
        throw new BadRequestException(
          `Duplicate or invalid enquiry field key at position ${index + 1}`,
        );
      }

      seenKeys.add(key);

      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        throw new BadRequestException(`Select field "${key}" must include at least one option`);
      }

      return {
        ...field,
        key,
        label: field.label.trim(),
        placeholder: field.placeholder?.trim() || undefined,
        section: 'intake',
        options:
          field.type === 'select'
            ? (field.options ?? [])
              .map((option) => option.trim())
              .filter((option, optionIndex, list) => option.length > 0 && list.indexOf(option) === optionIndex)
            : undefined,
      };
    });
  }

  private normalizeTestPackages(packages: TestPackage[]): TestPackage[] {
    const seenIds = new Set<string>();

    return packages.map((pkg, index) => {
      const name = pkg.name.trim();
      const normalizedId = (pkg.id || this.slugify(name) || `test-package-${index + 1}`).trim();

      if (!name) {
        throw new BadRequestException(`Test package at position ${index + 1} must have a name`);
      }

      if (!normalizedId || seenIds.has(normalizedId)) {
        throw new BadRequestException(`Duplicate or invalid test package id at position ${index + 1}`);
      }

      seenIds.add(normalizedId);

      return {
        id: normalizedId,
        name,
        description: pkg.description.trim(),
        enabled: pkg.enabled,
      };
    });
  }

  private validateCustomFieldCollisions(
    displayConfig: TenantDisplayConfig,
    customFields: CustomEnquiryField[],
  ): void {
    const existingCustomKeys = new Set(displayConfig.customEnquiryFields.map((field) => field.key));
    const reservedKeys = new Set(
      displayConfig.leadFieldsConfig.fields
        .map((field) => field.key)
        .filter((key) => !existingCustomKeys.has(key)),
    );

    const conflicts = customFields.map((field) => field.key).filter((key) => reservedKeys.has(key));
    if (conflicts.length > 0) {
      throw new BadRequestException(
        `These enquiry field keys are reserved and cannot be reused: ${conflicts.join(', ')}`,
      );
    }
  }

  private validateRequiredTestPackageAvailability(
    displayConfig: TenantDisplayConfig,
    testPackages: TestPackage[],
  ): void {
    const testField = displayConfig.leadFieldsConfig.fields.find(
      (field) => field.key === 'testOrPackage' && field.type === 'select' && field.required,
    );

    if (!testField) {
      return;
    }

    const enabledCount = testPackages.filter((pkg) => pkg.enabled).length;
    if (enabledCount === 0) {
      throw new BadRequestException('At least one test package must stay enabled');
    }
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private parseTime(value: string): [number, number] {
    const [hours, minutes] = value.split(':').map((part) => parseInt(part, 10));
    return [Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0];
  }
}
