import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Notification,
  NotificationSchema,
  RealtimeInvalidationEvent,
  RealtimeInvalidationEventSchema,
  REALTIME_SOCKET_CLIENT_EVENTS,
  REALTIME_SOCKET_SERVER_EVENTS,
} from '@leadops/shared';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

type InvalidationListener = (event: RealtimeInvalidationEvent) => void;
type NotificationListener = (notification: Notification) => void;

interface RealtimeContextValue {
  connected: boolean;
  subscribeInvalidation: (listener: InvalidationListener) => () => void;
  subscribeNotification: (listener: NotificationListener) => () => void;
  joinLeadRoom: (leadId: string) => void;
  leaveLeadRoom: (leadId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function resolveSocketBaseUrl(): string | undefined {
  const configured = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  if (!configured) {
    return undefined;
  }

  try {
    const url = new URL(configured, window.location.origin);
    return url.origin;
  } catch {
    return configured;
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { isAuthenticated, selectedBranchId, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef(new Set<InvalidationListener>());
  const notificationListenersRef = useRef(new Set<NotificationListener>());

  const subscribeInvalidation = useCallback((listener: InvalidationListener): (() => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const subscribeNotification = useCallback((listener: NotificationListener): (() => void) => {
    notificationListenersRef.current.add(listener);
    return () => {
      notificationListenersRef.current.delete(listener);
    };
  }, []);

  const joinLeadRoom = useCallback((leadId: string): void => {
    const socket = socketRef.current;
    if (!socket || !leadId.trim()) {
      return;
    }

    socket.emit(REALTIME_SOCKET_CLIENT_EVENTS.SUBSCRIBE_LEAD, { leadId: leadId.trim() });
  }, []);

  const leaveLeadRoom = useCallback((leadId: string): void => {
    const socket = socketRef.current;
    if (!socket || !leadId.trim()) {
      return;
    }

    socket.emit(REALTIME_SOCKET_CLIENT_EVENTS.UNSUBSCRIBE_LEAD, { leadId: leadId.trim() });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setConnected(false);
      return;
    }

    const baseUrl = resolveSocketBaseUrl();
    const socket = io(baseUrl ? `${baseUrl}/realtime` : '/realtime', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: {
        token: accessToken,
        branchId: selectedBranchId ?? null,
      },
    });

    socketRef.current = socket;

    const onConnect = (): void => setConnected(true);
    const onDisconnect = (): void => setConnected(false);
    const onInvalidation = (payload: unknown): void => {
      const parsed = RealtimeInvalidationEventSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      for (const listener of listenersRef.current) {
        listener(parsed.data);
      }
    };
    const onNotification = (payload: unknown): void => {
      const parsed = NotificationSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      for (const listener of notificationListenersRef.current) {
        listener(parsed.data);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(REALTIME_SOCKET_SERVER_EVENTS.INVALIDATION, onInvalidation);
    socket.on(REALTIME_SOCKET_SERVER_EVENTS.NOTIFICATION, onNotification);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(REALTIME_SOCKET_SERVER_EVENTS.INVALIDATION, onInvalidation);
      socket.off(REALTIME_SOCKET_SERVER_EVENTS.NOTIFICATION, onNotification);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [isAuthenticated, user?.id, user?.tenantId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isAuthenticated) {
      return;
    }

    socket.emit(REALTIME_SOCKET_CLIENT_EVENTS.SET_BRANCH, {
      branchId: selectedBranchId ?? null,
    });
  }, [isAuthenticated, selectedBranchId]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      subscribeInvalidation,
      subscribeNotification,
      joinLeadRoom,
      leaveLeadRoom,
    }),
    [connected, joinLeadRoom, leaveLeadRoom, subscribeInvalidation, subscribeNotification],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }

  return context;
}
