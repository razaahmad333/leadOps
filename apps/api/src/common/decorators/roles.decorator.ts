import { SetMetadata } from '@nestjs/common';
import { Role } from '@leadops/shared';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict a route to specific roles.
 * Usage: @Roles(Role.OWNER) or @Roles(Role.OWNER, Role.STAFF)
 */
export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
