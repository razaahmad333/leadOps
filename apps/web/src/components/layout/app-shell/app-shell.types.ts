import type React from 'react';

export interface NavItem {
  to: string;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  superAdminOnly?: boolean;
}

export interface ManualModule {
  id: string;
  title: string;
  description: string;
  route: string;
}
