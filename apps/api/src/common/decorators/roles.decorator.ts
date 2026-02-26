import { SetMetadata } from '@nestjs/common';
import { Role } from '@leadops/shared';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
