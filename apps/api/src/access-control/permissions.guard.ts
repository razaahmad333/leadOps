import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '@leadops/shared';
import { AccessControlService } from './access-control.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControl: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      requestId?: string;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hydratedUser = user.effectivePermissions.length
      ? user
      : await this.accessControl.buildAuthUser(user.id, user.tenantId, request.requestId, {
        includeAvailableTenants: false,
      });

    const effectivePermissions = new Set(hydratedUser.effectivePermissions);
    const missing = requiredPermissions.filter((permission) => !effectivePermissions.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(`Missing required permission: ${missing.join(', ')}`);
    }

    request.user = hydratedUser;
    return true;
  }
}
