import { IndustryPreset, Role as LegacyRole } from '@leadops/shared';

export interface PermissionSeed {
  key: string;
  description: string;
  group: string;
}

export interface RoleTemplateSeed {
  name: string;
  description: string;
  permissionKeys: string[];
  isSystem?: boolean;
}

export const PERMISSION_CATALOG: PermissionSeed[] = [
  { key: 'dashboard.view', description: 'View tenant dashboard metrics.', group: 'Dashboard' },
  { key: 'analytics.view', description: 'View tenant analytics and performance summaries.', group: 'Dashboard' },
  { key: 'enquiries.view', description: 'View enquiries and lead records.', group: 'Enquiries' },
  { key: 'enquiries.create', description: 'Create new enquiries and leads.', group: 'Enquiries' },
  { key: 'enquiries.edit', description: 'Edit enquiry details, stages, and notes.', group: 'Enquiries' },
  { key: 'followups.view', description: 'View follow-up queues and schedules.', group: 'Follow-ups' },
  { key: 'followups.create', description: 'Create follow-up tasks.', group: 'Follow-ups' },
  { key: 'followups.complete', description: 'Mark follow-up tasks as complete.', group: 'Follow-ups' },
  { key: 'settings.view', description: 'View tenant settings and workflow configuration.', group: 'Settings' },
  { key: 'pipeline.manage', description: 'Manage workflow stages and pipeline rules.', group: 'Settings' },
  { key: 'templates.manage', description: 'Manage outreach and reminder templates.', group: 'Settings' },
  { key: 'users.view', description: 'View tenant users and access summaries.', group: 'Team' },
  { key: 'users.manage', description: 'Create, edit, activate, and deactivate users.', group: 'Team' },
  { key: 'roles.view', description: 'View tenant role bundles.', group: 'Team' },
  { key: 'roles.manage', description: 'Create and edit tenant role bundles.', group: 'Team' },
  { key: 'permissions.view', description: 'View the permission catalog.', group: 'Team' },
  { key: 'branches.view', description: 'View tenant branches and branch scope.', group: 'Team' },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((permission) => permission.key);

function ownerPermissions(): string[] {
  return [...ALL_PERMISSION_KEYS];
}

export function getAdminRoleName(preset: IndustryPreset): string {
  return preset === IndustryPreset.DIAGNOSTICS_LAB ? 'Lab Admin' : 'Tenant Admin';
}

export function getLegacyRoleTemplateName(preset: IndustryPreset, legacyRole: LegacyRole): string {
  if (legacyRole === LegacyRole.OWNER) {
    return 'Owner';
  }

  return preset === IndustryPreset.DIAGNOSTICS_LAB ? 'Reception' : 'Staff';
}

export function getDefaultBranchNames(preset: IndustryPreset): string[] {
  if (preset === IndustryPreset.DIAGNOSTICS_LAB) {
    return ['Main Lab', 'Home Collection'];
  }

  return ['Main Branch'];
}

export function getDefaultRoleTemplates(preset: IndustryPreset): RoleTemplateSeed[] {
  const adminRole: RoleTemplateSeed = {
    name: getAdminRoleName(preset),
    description:
      preset === IndustryPreset.DIAGNOSTICS_LAB
        ? 'Full tenant access for lab administrators.'
        : 'Full tenant access for tenant administrators.',
    permissionKeys: [...ALL_PERMISSION_KEYS],
    isSystem: true,
  };

  const ownerRole: RoleTemplateSeed = {
    name: 'Owner',
    description: 'Operational owner with team, workflow, and reporting access.',
    permissionKeys: ownerPermissions(),
  };

  if (preset === IndustryPreset.DIAGNOSTICS_LAB) {
    return [
      adminRole,
      ownerRole,
      {
        name: 'Reception',
        description: 'Front-desk team handling intake and follow-up coordination.',
        permissionKeys: [
          'enquiries.view',
          'enquiries.create',
          'enquiries.edit',
          'followups.view',
          'followups.create',
          'followups.complete',
          'branches.view',
        ],
      },
      {
        name: 'Collector Coordinator',
        description: 'Coordinates sample collection and post-booking tasks.',
        permissionKeys: [
          'enquiries.view',
          'enquiries.edit',
          'followups.view',
          'followups.complete',
          'branches.view',
        ],
      },
    ];
  }

  return [
    adminRole,
    ownerRole,
    {
      name: 'Staff',
      description: 'Standard operating user for lead and follow-up execution.',
      permissionKeys: [
        'enquiries.view',
        'enquiries.create',
        'enquiries.edit',
        'followups.view',
        'followups.create',
        'followups.complete',
      ],
    },
  ];
}

export function getAllPermissionKeys(): string[] {
  return [...ALL_PERMISSION_KEYS];
}
