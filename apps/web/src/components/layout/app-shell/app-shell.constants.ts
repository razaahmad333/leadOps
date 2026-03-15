export const MANUAL_DESCRIPTION_BY_ROUTE: Record<string, string> = {
  '/owner/dashboard': 'Review branch-aware KPIs, follow-up health, and pipeline charts for the current scope.',
  '/staff/today': 'Work the Due Queue with status filters for all due, due today, overdue, and escalated follow-ups.',
  '/support/questions': 'Submit tenant questions, review answered guidance, and let tenant answerers or superadmin respond in-app.',
  '/leads': 'Create and manage leads, filter by created date, export lead data, keep next follow-up in sync, and maintain ownership and activity history.',
  '/settings': 'Configure reminder rules, default follow-up timing, timezone, and business hours.',
  '/settings/team': 'Create users and manage branch scope/default branch access.',
  '/settings/roles': 'Create and maintain role bundles for permission-based access.',
  '/settings/permissions': 'Inspect the live permission catalog used by role definitions.',
  '/platform/admin': 'Superadmin workspace for tenant, user, branch, role, and settings operations.',
};

export const NAV_TOUR_ID_BY_PATH: Record<string, string> = {
  '/owner/dashboard': 'nav-dashboard',
  '/staff/today': 'nav-today',
  '/support/questions': 'nav-faq',
  '/leads': 'nav-leads',
  '/settings/team': 'nav-team',
  '/settings/roles': 'nav-roles',
  '/settings/permissions': 'nav-permissions',
  '/settings': 'nav-settings',
  '/platform/admin': 'nav-platform-admin',
};
