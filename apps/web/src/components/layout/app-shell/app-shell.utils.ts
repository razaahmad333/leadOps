import { NAV_TOUR_ID_BY_PATH } from './app-shell.constants';

export function resolveDefaultRouteForPermissions(permissions: string[]): string {
  if (permissions.includes('dashboard.view')) {
    return '/owner/dashboard';
  }

  if (permissions.includes('followups.view')) {
    return '/staff/today';
  }

  if (permissions.includes('enquiries.view')) {
    return '/leads';
  }

  if (permissions.includes('settings.view')) {
    return '/settings';
  }

  return '/login';
}

export function navTourId(path: string): string {
  const known = NAV_TOUR_ID_BY_PATH[path];
  if (known) {
    return known;
  }

  return `nav-${path.replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

export function resolveSupportContacts(input: {
  phone?: string | undefined;
  email?: string | undefined;
}): {
  supportPhone: string;
  supportEmail: string;
  supportPhoneHref: string;
} {
  const supportPhone = (input.phone ?? '+1 555 010 1000').trim();
  const supportEmail = (input.email ?? 'support@hikmahone.com').trim();
  return {
    supportPhone,
    supportEmail,
    supportPhoneHref: `tel:${supportPhone.replace(/[^\d+]/g, '')}`,
  };
}
