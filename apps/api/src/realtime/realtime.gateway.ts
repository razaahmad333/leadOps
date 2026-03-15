import {
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type {
  AuthUser,
  RealtimeInvalidationEvent,
  RealtimeNotification,
} from '@leadops/shared';
import {
  RealtimeBranchSelectionSchema,
  RealtimeLeadSubscriptionSchema,
  REALTIME_SOCKET_CLIENT_EVENTS,
  REALTIME_SOCKET_SERVER_EVENTS,
} from '@leadops/shared';
import type { Server, Socket } from 'socket.io';
import { AccessControlService } from '../access-control/access-control.service';
import { BranchScopeService } from '../access-control/branch-scope.service';
import { isAllowedOrigin, resolveConfiguredOrigins } from '../common/security/origin.util';
import { PrismaService } from '../prisma/prisma.service';
import { branchRoom, leadRoom, tenantRoom, userRoom } from './realtime.rooms';

interface AccessTokenPayload {
  sub: string;
  accountId: string;
  tenantId: string;
  kind?: string;
}

interface RealtimeSession {
  user: AuthUser;
  selectedBranchId: string | null;
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin, {
        allowLocalhost: process.env.NODE_ENV !== 'production',
        configuredOrigins: resolveConfiguredOrigins(process.env.CORS_ORIGIN),
        allowNoOrigin: process.env.NODE_ENV !== 'production',
      }));
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly sessions = new Map<string, RealtimeSession>();

  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly accessControl: AccessControlService,
    private readonly branchScope: BranchScopeService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const session = await this.authenticate(client);
      this.sessions.set(client.id, session);

      client.join(tenantRoom(session.user.tenantId));
      client.join(userRoom(session.user.id));

      if (session.selectedBranchId) {
        client.join(branchRoom(session.user.tenantId, session.selectedBranchId));
      }
    } catch (error) {
      this.logger.warn(
        `Rejected realtime connection ${client.id}: ${error instanceof Error ? error.message : 'Unauthorized'}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.sessions.delete(client.id);
  }

  @SubscribeMessage(REALTIME_SOCKET_CLIENT_EVENTS.SET_BRANCH)
  setBranchSelection(
    @ConnectedSocket() client: Socket,
    payload: unknown,
  ): { ok: true; branchId: string | null } {
    const session = this.sessionFor(client);
    const parsed = RealtimeBranchSelectionSchema.safeParse(payload);

    if (!parsed.success) {
      throw new WsException('Invalid branch selection payload');
    }

    const nextBranchId = this.normalizeBranchId(parsed.data.branchId);
    this.branchScope.ensureBranchAccess(session.user, nextBranchId);

    if (session.selectedBranchId) {
      client.leave(branchRoom(session.user.tenantId, session.selectedBranchId));
    }

    if (nextBranchId) {
      client.join(branchRoom(session.user.tenantId, nextBranchId));
    }

    session.selectedBranchId = nextBranchId;
    this.sessions.set(client.id, session);

    return {
      ok: true,
      branchId: nextBranchId,
    };
  }

  @SubscribeMessage(REALTIME_SOCKET_CLIENT_EVENTS.SUBSCRIBE_LEAD)
  async subscribeLeadRoom(
    @ConnectedSocket() client: Socket,
    payload: unknown,
  ): Promise<{ ok: true }> {
    const session = this.sessionFor(client);
    const parsed = RealtimeLeadSubscriptionSchema.safeParse(payload);

    if (!parsed.success) {
      throw new WsException('Invalid lead subscription payload');
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: parsed.data.leadId,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!lead) {
      throw new WsException('Lead not found');
    }

    this.branchScope.ensureBranchAccess(session.user, lead.branchId);
    client.join(leadRoom(lead.id));

    return { ok: true };
  }

  @SubscribeMessage(REALTIME_SOCKET_CLIENT_EVENTS.UNSUBSCRIBE_LEAD)
  unsubscribeLeadRoom(
    @ConnectedSocket() client: Socket,
    payload: unknown,
  ): { ok: true } {
    const parsed = RealtimeLeadSubscriptionSchema.safeParse(payload);

    if (!parsed.success) {
      throw new WsException('Invalid lead subscription payload');
    }

    client.leave(leadRoom(parsed.data.leadId));
    return { ok: true };
  }

  emitInvalidation(event: RealtimeInvalidationEvent): void {
    if (!this.server) {
      this.logger.debug('Realtime server not ready. Skipping invalidation emit.');
      return;
    }

    const rooms = [tenantRoom(event.tenantId)];
    if (event.branchId) {
      rooms.push(branchRoom(event.tenantId, event.branchId));
    }
    if (event.leadId) {
      rooms.push(leadRoom(event.leadId));
    }

    this.server.to(rooms).emit(REALTIME_SOCKET_SERVER_EVENTS.INVALIDATION, event);
  }

  emitNotification(notification: RealtimeNotification): void {
    if (!this.server) {
      this.logger.debug('Realtime server not ready. Skipping notification emit.');
      return;
    }

    this.server.to(userRoom(notification.userId)).emit(REALTIME_SOCKET_SERVER_EVENTS.NOTIFICATION, notification);
  }

  private async authenticate(client: Socket): Promise<RealtimeSession> {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Missing realtime access token');
    }

    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);

    if (payload.kind && payload.kind !== 'access') {
      throw new UnauthorizedException('Invalid access token for realtime session');
    }

    const user = await this.accessControl.buildAuthUser(payload.sub, payload.tenantId, undefined, {
      includeAvailableTenants: false,
    });
    if (user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Token tenant does not match user tenant');
    }

    const selectedBranchId = this.normalizeBranchId(this.extractBranchId(client));
    this.branchScope.ensureBranchAccess(user, selectedBranchId);

    return {
      user,
      selectedBranchId,
    };
  }

  private sessionFor(client: Socket): RealtimeSession {
    const session = this.sessions.get(client.id);
    if (!session) {
      throw new WsException('Realtime session not initialized');
    }

    return session;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const authToken = auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const authorizationHeader = client.handshake.headers.authorization;
    if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
      return authorizationHeader.slice('Bearer '.length).trim();
    }

    if (Array.isArray(authorizationHeader) && authorizationHeader[0]?.startsWith('Bearer ')) {
      return authorizationHeader[0].slice('Bearer '.length).trim();
    }

    return null;
  }

  private extractBranchId(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const authBranch = auth?.branchId;
    if (typeof authBranch === 'string') {
      return authBranch;
    }

    const headerBranch = client.handshake.headers['x-branch-id'];
    if (typeof headerBranch === 'string') {
      return headerBranch;
    }

    if (Array.isArray(headerBranch) && typeof headerBranch[0] === 'string') {
      return headerBranch[0];
    }

    return null;
  }

  private normalizeBranchId(input: string | null | undefined): string | null {
    if (!input) {
      return null;
    }

    const normalized = input.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
