export const MANUAL_DESCRIPTION_BY_ROUTE: Record<string, string> = {
  '/owner/dashboard': 'Review daily KPIs and workflow health signals.',
  '/staff/today': 'Track due tasks, include overdue items, and close follow-ups quickly.',
  '/leads': 'Search enquiries, update statuses, and maintain activity history.',
  '/settings': 'Configure reminder rules, timezone, and business hours.',
  '/settings/team': 'Create users and manage branch scope/default branch access.',
  '/settings/roles': 'Create and maintain role bundles for permission-based access.',
  '/settings/permissions': 'Inspect the live permission catalog used by role definitions.',
  '/platform/admin': 'Superadmin workspace for tenant, user, branch, role, and settings operations.',
};

export const NAV_TOUR_ID_BY_PATH: Record<string, string> = {
  '/owner/dashboard': 'nav-dashboard',
  '/staff/today': 'nav-today',
  '/leads': 'nav-leads',
  '/settings/team': 'nav-team',
  '/settings/roles': 'nav-roles',
  '/settings/permissions': 'nav-permissions',
  '/settings': 'nav-settings',
  '/platform/admin': 'nav-platform-admin',
};
