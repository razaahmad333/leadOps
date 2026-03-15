import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Tenant } from '@prisma/client';
import {
  CustomEnquiryField,
  FollowupPurposeOption,
  FollowupRules,
  IndustryPreset,
  LeadStatus,
  MilestoneKey,
  OpdDirectory,
  PipelineStage,
  TenantDisplayConfig,
  TenantDisplayConfigSchema,
  TenantIntakeConfig,
  TenantLoginBranding,
  TenantProfile,
  TenantSettings,
  PublicTenantBranding,
  TestPackage,
  UpdateTenantIntakeConfigDto,
  UpdateTenantSettingsDto,
} from '@leadops/shared';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from './tenant.store';
import { getPresetDisplayConfig } from './tenant-presets';
import { DEFAULT_TENANT_TIMEZONE } from './tenant-defaults';

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
          timezone: DEFAULT_TENANT_TIMEZONE,
          businessStart: '09:00',
          businessEnd: '18:00',
          stages: ['New', 'Contacted', 'Qualified', 'Pending', 'Won', 'Lost'],
          reminderRules: {
            defaultLeadFollowupMinutes: 120,
            firstReminderMinutes: 30,
            escalationMinutes: 120,
            postReportFollowupDays: 3,
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
      timezone: configRecord?.timezone ?? DEFAULT_TENANT_TIMEZONE,
      businessStart: configRecord?.businessStart ?? '09:00',
      businessEnd: configRecord?.businessEnd ?? '18:00',
      stages: profile.displayConfig.pipelineConfig.stages.map((stage) => stage.label),
      reminderRules: {
        defaultLeadFollowupMinutes: profile.displayConfig.followupRules.defaultLeadFollowupMinutes,
        firstReminderMinutes: profile.displayConfig.followupRules.firstReminderMinutes,
        escalationMinutes: profile.displayConfig.followupRules.escalationMinutes,
        postReportFollowupDays: profile.displayConfig.followupRules.postReportFollowupDays,
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
      opdDirectory: profile.displayConfig.opdDirectory ?? {
        departments: [],
        doctors: [],
      },
    };
  }

  async getPublicTenantBranding(tenantSlug: string): Promise<PublicTenantBranding> {
    const normalizedSlug = tenantSlug.trim().toLowerCase();
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const profile = await this.getTenantProfile(tenant.id);
    const presetBranding = getPresetDisplayConfig(profile.industryPreset).loginBranding;
    const branding = this.resolvePublicBranding({
      tenantName: tenant.name,
      branding: profile.displayConfig.loginBranding,
      presetBranding: presetBranding ?? null,
      logoFallback: profile.displayConfig.themeConfig?.logoMarkUrl,
    });

    return {
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      branding,
    };
  }

  async updateIntakeConfig(
    input: UpdateTenantIntakeConfigDto,
    tenantId?: string,
  ): Promise<TenantIntakeConfig> {
    const profile = await this.getTenantProfile(tenantId);

    const normalizedCustomFields = this.normalizeCustomEnquiryFields(input.customEnquiryFields);
    const normalizedTestPackages = this.normalizeTestPackages(input.testPackages);
    const normalizedOpdDirectory = this.normalizeOpdDirectory(input.opdDirectory);

    this.validateCustomFieldCollisions(profile.displayConfig, normalizedCustomFields);
    this.validateRequiredTestPackageAvailability(profile.displayConfig, normalizedTestPackages);

    const nextDisplayConfig = this.applyDerivedIntakeConfig({
      ...profile.displayConfig,
      customEnquiryFields: normalizedCustomFields,
      testPackages: normalizedTestPackages,
      opdDirectory: normalizedOpdDirectory,
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
      opdDirectory: nextDisplayConfig.opdDirectory ?? {
        departments: [],
        doctors: [],
      },
    };
  }

  async updateSettings(
    input: UpdateTenantSettingsDto,
    tenantId?: string,
    actorId?: string,
  ): Promise<TenantSettings> {
    const resolvedTenantId = tenantId ?? getTenantContext()?.tenantId;
    if (!resolvedTenantId || resolvedTenantId === 'system') {
      throw new BadRequestException('Tenant context missing');
    }

    const profile = await this.getTenantProfile(resolvedTenantId);
    const configRecord = await this.prisma.tenantConfig.findUnique({
      where: { tenantId: resolvedTenantId },
    });

    if (!configRecord) {
      throw new NotFoundException('Tenant config not found');
    }

    const currentTimezone = configRecord.timezone || DEFAULT_TENANT_TIMEZONE;
    const currentBusinessStart = configRecord.businessStart || '09:00';
    const currentBusinessEnd = configRecord.businessEnd || '18:00';

    const nextTimezone = input.timezone?.trim() || currentTimezone;
    const nextBusinessStart = input.businessStart ?? currentBusinessStart;
    const nextBusinessEnd = input.businessEnd ?? currentBusinessEnd;

    this.assertValidTimeZone(nextTimezone);
    this.assertValidBusinessWindow(nextBusinessStart, nextBusinessEnd);

    const currentRules = profile.displayConfig.followupRules;
    const nextRules = {
      ...currentRules,
      ...(input.reminderRules?.defaultLeadFollowupMinutes !== undefined
        ? { defaultLeadFollowupMinutes: input.reminderRules.defaultLeadFollowupMinutes }
        : {}),
      ...(input.reminderRules?.firstReminderMinutes !== undefined
        ? { firstReminderMinutes: input.reminderRules.firstReminderMinutes }
        : {}),
      ...(input.reminderRules?.escalationMinutes !== undefined
        ? { escalationMinutes: input.reminderRules.escalationMinutes }
        : {}),
      ...(input.reminderRules?.postReportFollowupDays !== undefined
        ? { postReportFollowupDays: input.reminderRules.postReportFollowupDays }
        : {}),
    };

    const changedFields = this.collectSettingsDiff({
      currentTimezone,
      currentBusinessStart,
      currentBusinessEnd,
      currentRules,
      nextTimezone,
      nextBusinessStart,
      nextBusinessEnd,
      nextRules,
    });

    if (Object.keys(changedFields).length === 0) {
      return this.getSettings(resolvedTenantId);
    }

    const nextDisplayConfig = {
      ...profile.displayConfig,
      followupRules: nextRules,
    };

    await this.prisma.tenantConfig.update({
      where: { tenantId: resolvedTenantId },
      data: {
        timezone: nextTimezone,
        businessStart: nextBusinessStart,
        businessEnd: nextBusinessEnd,
        reminderRules: {
          defaultLeadFollowupMinutes: nextRules.defaultLeadFollowupMinutes,
          firstReminderMinutes: nextRules.firstReminderMinutes,
          escalationMinutes: nextRules.escalationMinutes,
          postReportFollowupDays: nextRules.postReportFollowupDays,
        },
        displayConfig: nextDisplayConfig,
      },
    });

    await this.prisma.tenantAuditEvent.create({
      data: {
        tenantId: resolvedTenantId,
        actorId: actorId ?? null,
        entityType: 'TENANT_SETTINGS',
        entityId: resolvedTenantId,
        action: 'tenant.settings.updated',
        metadata: changedFields as Prisma.InputJsonValue,
      },
    });

    this.invalidate(resolvedTenantId);
    return this.getSettings(resolvedTenantId);
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

  async resolveFollowupPurpose(
    input: {
      stageKey?: string | null;
      purposeKey?: string | null;
      tenantId?: string;
      fallbackKey?: string;
      fallbackLabel?: string;
    },
  ): Promise<{ key: string; label: string; guidance?: string; purposes: FollowupPurposeOption[] }> {
    const stage = input.stageKey
      ? await this.resolveStage(input.stageKey, input.tenantId)
      : await this.getDefaultStage(input.tenantId);

    if (stage) {
      const matchedPurpose = input.purposeKey
        ? stage.followupPurposes.find((purpose) => purpose.key === input.purposeKey)
        : null;

      if (input.purposeKey && !matchedPurpose) {
        throw new BadRequestException(`Purpose ${input.purposeKey} is not allowed for stage ${stage.key}`);
      }

      const defaultPurpose =
        matchedPurpose
        ?? stage.followupPurposes.find((purpose) => purpose.key === stage.defaultFollowupPurposeKey)
        ?? stage.followupPurposes[0];

      if (defaultPurpose) {
        return {
          key: defaultPurpose.key,
          label: defaultPurpose.label,
          guidance: stage.followupGuidance,
          purposes: stage.followupPurposes,
        };
      }
    }

    return {
      key: input.fallbackKey ?? 'general_followup',
      label: input.fallbackLabel ?? 'General Follow-up',
      purposes: [
        {
          key: input.fallbackKey ?? 'general_followup',
          label: input.fallbackLabel ?? 'General Follow-up',
        },
      ],
    };
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
    if (
      value === IndustryPreset.DIAGNOSTICS_LAB
      || value === 'COSMETIC_CLINIC'
      || value === 'DENTAL_CLINIC'
      || value === 'DOCTOR_OPD_CLINIC'
    ) {
      return value as IndustryPreset;
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

    const source = overrideConfig as Record<string, unknown>;
    const merged = this.deepMerge(base, source);
    const sourcePipelineConfig =
      source.pipelineConfig && typeof source.pipelineConfig === 'object'
        ? (source.pipelineConfig as Record<string, unknown>)
        : null;

    if (sourcePipelineConfig && Array.isArray(sourcePipelineConfig.stages)) {
      merged.pipelineConfig = {
        ...merged.pipelineConfig,
        stages: this.mergePipelineStages(base.pipelineConfig.stages, sourcePipelineConfig.stages),
      };
    }

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

  private mergePipelineStages(baseStages: PipelineStage[], overrideStages: unknown[]): PipelineStage[] {
    return overrideStages.map((stage) => {
      if (!stage || typeof stage !== 'object') {
        return stage as PipelineStage;
      }

      const overrideStage = stage as Record<string, unknown>;
      const stageKey = typeof overrideStage.key === 'string' ? overrideStage.key : null;
      const baseStage = stageKey ? baseStages.find((item) => item.key === stageKey) : null;

      if (!baseStage) {
        return overrideStage as unknown as PipelineStage;
      }

      return this.deepMerge(baseStage as unknown as Record<string, unknown>, overrideStage) as PipelineStage;
    });
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
          defaultLeadFollowupMinutes: mergedDisplayConfig.followupRules.defaultLeadFollowupMinutes,
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
          defaultLeadFollowupMinutes: mergedDisplayConfig.followupRules.defaultLeadFollowupMinutes,
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
    const timezone = tenant.config?.timezone ?? DEFAULT_TENANT_TIMEZONE;
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
    const normalizedOpdDirectory = this.normalizeOpdDirectory(config.opdDirectory ?? {
      departments: [],
      doctors: [],
    });
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

    const departmentFieldIndex = baseFields.findIndex(
      (field) => field.key === 'departmentOrSpeciality' && field.type === 'select',
    );
    if (departmentFieldIndex >= 0) {
      baseFields[departmentFieldIndex] = {
        ...baseFields[departmentFieldIndex],
        options: normalizedOpdDirectory.departments
          .filter((department) => department.isActive)
          .map((department) => department.name),
      };
    }

    const doctorFieldIndex = baseFields.findIndex(
      (field) => field.key === 'preferredDoctor' && field.type === 'select',
    );
    if (doctorFieldIndex >= 0) {
      baseFields[doctorFieldIndex] = {
        ...baseFields[doctorFieldIndex],
        options: normalizedOpdDirectory.doctors
          .filter((doctor) => doctor.enabled)
          .map((doctor) => doctor.name),
      };
    }

    return {
      ...config,
      customEnquiryFields: normalizedCustomFields,
      testPackages: normalizedTestPackages,
      opdDirectory: normalizedOpdDirectory,
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

  private normalizeOpdDirectory(directory: OpdDirectory): OpdDirectory {
    const seenDepartmentIds = new Set<string>();
    const departments = directory.departments.map((department, index) => {
      const name = department.name.trim();
      const id = (department.id || this.slugify(name) || `department-${index + 1}`).trim();

      if (!name) {
        throw new BadRequestException(`Department at position ${index + 1} must have a name`);
      }

      if (!id || seenDepartmentIds.has(id)) {
        throw new BadRequestException(`Duplicate or invalid department id at position ${index + 1}`);
      }

      seenDepartmentIds.add(id);

      return {
        id,
        name,
        isActive: department.isActive,
      };
    });

    const departmentIds = new Set(departments.map((department) => department.id));
    const seenDoctorIds = new Set<string>();
    const doctors = directory.doctors.map((doctor, index) => {
      const name = doctor.name.trim();
      const id = (doctor.id || this.slugify(name) || `doctor-${index + 1}`).trim();

      if (!name) {
        throw new BadRequestException(`Doctor at position ${index + 1} must have a name`);
      }

      if (!id || seenDoctorIds.has(id)) {
        throw new BadRequestException(`Duplicate or invalid doctor id at position ${index + 1}`);
      }

      const normalizedDepartmentIds = [...new Set(doctor.departmentIds.map((departmentId) => departmentId.trim()).filter(Boolean))];
      const invalidDepartmentId = normalizedDepartmentIds.find((departmentId) => !departmentIds.has(departmentId));
      if (invalidDepartmentId) {
        throw new BadRequestException(`Doctor "${name}" references an unknown department`);
      }

      seenDoctorIds.add(id);

      return {
        id,
        name,
        departmentIds: normalizedDepartmentIds,
        enabled: doctor.enabled,
      };
    });

    return {
      departments,
      doctors,
    };
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

  private assertValidTimeZone(value: string): void {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    } catch {
      throw new BadRequestException('Invalid timezone. Use an IANA timezone value');
    }
  }

  private assertValidBusinessWindow(start: string, end: string): void {
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(start) || !timePattern.test(end)) {
      throw new BadRequestException('Business window must use HH:mm (24-hour format)');
    }

    const [startHour, startMinute] = this.parseTime(start);
    const [endHour, endMinute] = this.parseTime(end);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes >= endMinutes) {
      throw new BadRequestException('businessStart must be earlier than businessEnd');
    }
  }

  private collectSettingsDiff(input: {
    currentTimezone: string;
    currentBusinessStart: string;
    currentBusinessEnd: string;
    currentRules: FollowupRules;
    nextTimezone: string;
    nextBusinessStart: string;
    nextBusinessEnd: string;
    nextRules: FollowupRules;
  }): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    if (input.currentTimezone !== input.nextTimezone) {
      changes.timezone = { from: input.currentTimezone, to: input.nextTimezone };
    }

    if (input.currentBusinessStart !== input.nextBusinessStart) {
      changes.businessStart = { from: input.currentBusinessStart, to: input.nextBusinessStart };
    }

    if (input.currentBusinessEnd !== input.nextBusinessEnd) {
      changes.businessEnd = { from: input.currentBusinessEnd, to: input.nextBusinessEnd };
    }

    if (input.currentRules.defaultLeadFollowupMinutes !== input.nextRules.defaultLeadFollowupMinutes) {
      changes.defaultLeadFollowupMinutes = {
        from: input.currentRules.defaultLeadFollowupMinutes,
        to: input.nextRules.defaultLeadFollowupMinutes,
      };
    }

    if (input.currentRules.firstReminderMinutes !== input.nextRules.firstReminderMinutes) {
      changes.firstReminderMinutes = {
        from: input.currentRules.firstReminderMinutes,
        to: input.nextRules.firstReminderMinutes,
      };
    }

    if (input.currentRules.escalationMinutes !== input.nextRules.escalationMinutes) {
      changes.escalationMinutes = {
        from: input.currentRules.escalationMinutes,
        to: input.nextRules.escalationMinutes,
      };
    }

    if (input.currentRules.postReportFollowupDays !== input.nextRules.postReportFollowupDays) {
      changes.postReportFollowupDays = {
        from: input.currentRules.postReportFollowupDays,
        to: input.nextRules.postReportFollowupDays,
      };
    }

    return changes;
  }

  private resolvePublicBranding(input: {
    tenantName: string;
    branding: TenantLoginBranding | undefined;
    presetBranding: TenantLoginBranding | null;
    logoFallback: string | undefined;
  }): TenantLoginBranding {
    const fallback: TenantLoginBranding = input.presetBranding ?? {
      eyebrow: 'HikmahOne',
      headline: 'Welcome to your workspace',
      subheadline: 'Sign in to continue.',
      highlightOneLabel: 'Workspace',
      highlightOneText: 'Track every enquiry',
      highlightTwoLabel: 'Follow-ups',
      highlightTwoText: 'Stay on top of due tasks',
      calloutTitle: 'Built for operations',
      calloutText: 'Bring team visibility and execution into one focused workspace.',
    };

    const merged: TenantLoginBranding = {
      ...fallback,
      ...(input.branding ?? {}),
    };

    if (!merged.logoUrl && input.logoFallback) {
      if (this.isSafePublicLogoUrl(input.logoFallback)) {
        merged.logoUrl = input.logoFallback;
      }
    }

    if (!merged.logoAlt) {
      merged.logoAlt = `${input.tenantName} logo`;
    }

    return merged;
  }

  private isSafePublicLogoUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
