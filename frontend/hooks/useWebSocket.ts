import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageStatus } from '@/types/message';

const getWebSocketUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051';
  return apiUrl.replace(/\/api\/?$/, '');
};

const BACKEND_URL = getWebSocketUrl();

// ─── Módulo singleton ────────────────────────────────────────────────────────
// Uma única conexão WebSocket é compartilhada por todas as instâncias do hook
// no mesmo contexto de módulo (mesma aba do browser). Isso elimina o problema
// de 2-3 sockets simultâneos que causavam eventos duplicados e instabilidade.

let sharedSocket: Socket | null = null;
let moduleAuthenticated = false;

type ModuleState = { connected: boolean; authenticated: boolean };
const stateSubscribers = new Set<(state: ModuleState) => void>();

function notifySubscribers(): void {
  const state: ModuleState = {
    connected: sharedSocket?.connected ?? false,
    authenticated: moduleAuthenticated,
  };
  stateSubscribers.forEach(cb => cb(state));
}

function ensureSocket(): Socket {
  // Reutiliza o socket se já existe e está ativo (conectado ou reconectando)
  if (sharedSocket?.active) return sharedSocket;

  if (sharedSocket) sharedSocket.removeAllListeners();

  sharedSocket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  moduleAuthenticated = false;

  sharedSocket.on('connect', () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) sharedSocket!.emit('authenticate', token);
    notifySubscribers();
  });

  sharedSocket.on('authenticated', () => {
    moduleAuthenticated = true;
    notifySubscribers();
  });

  sharedSocket.on('auth_error', (error: unknown) => {
    console.error('[WebSocket] Authentication error:', error);
    moduleAuthenticated = false;
    notifySubscribers();
  });

  sharedSocket.on('disconnect', () => {
    moduleAuthenticated = false;
    notifySubscribers();
  });

  sharedSocket.on('connect_error', (error: Error) => {
    console.error('[WebSocket] Connection error:', error.message);
  });

  sharedSocket.on('reconnect_error', (error: Error) => {
    console.error('[WebSocket] Reconnection error:', error.message);
  });

  return sharedSocket;
}
// ─────────────────────────────────────────────────────────────────────────────

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onNewMessage?: (message: {
    id: string;
    customerId: string;
    customerName?: string;
    direction?: string;
    content?: string;
    timestamp?: string;
    status?: string;
    senderType?: string | null;
    mediaType?: string | null;
    aiEnabled?: boolean;
    whatsappInstanceId?: string;
  }) => void;
  onConversationUpdate?: (update: Record<string, unknown>) => void;
  onTyping?: (data: { customerId: string; isTyping: boolean }) => void;
  onStatsUpdate?: (stats: Record<string, unknown>) => void;
  onMessageStatus?: (data: { messageId: string; status: MessageStatus; timestamp: Date }) => void;
  onMessageEdited?: (data: { messageId: string; newContent: string; customerId: string }) => void;
  onMessageDeleted?: (data: { messageId: string; customerId: string }) => void;
  onInstanceDisconnected?: (data: { instanceName: string; timestamp: string }) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true } = options;

  const [isConnected, setIsConnected] = useState(() => sharedSocket?.connected ?? false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => moduleAuthenticated);

  // Mantém sempre a versão mais recente dos callbacks sem recriar listeners
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    if (!autoConnect) return;

    const socket = ensureSocket();

    // Sincroniza estado inicial imediatamente
    setIsConnected(socket.connected);
    setIsAuthenticated(moduleAuthenticated);

    // Se já conectado mas não autenticado ainda, tenta autenticar agora
    if (socket.connected && !moduleAuthenticated) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) socket.emit('authenticate', token);
    }

    // Assina mudanças de estado do singleton
    const onState = ({ connected, authenticated }: ModuleState) => {
      setIsConnected(connected);
      setIsAuthenticated(authenticated);
    };
    stateSubscribers.add(onState);

    // Registra os event listeners do caller usando wrappers que acessam o ref
    // Isso garante que a versão mais recente do callback é sempre chamada,
    // sem precisar re-registrar os listeners quando as funções mudam.
    type EventKey = keyof Pick<UseWebSocketOptions,
      'onNewMessage' | 'onConversationUpdate' | 'onTyping' |
      'onStatsUpdate' | 'onMessageStatus' | 'onMessageEdited' | 'onMessageDeleted' |
      'onInstanceDisconnected'
    >;
    const eventMap: Record<string, EventKey> = {
      'new_message': 'onNewMessage',
      'conversation_update': 'onConversationUpdate',
      'typing': 'onTyping',
      'stats_update': 'onStatsUpdate',
      'message_status': 'onMessageStatus',
      'message_edited': 'onMessageEdited',
      'message_deleted': 'onMessageDeleted',
      'instance_disconnected': 'onInstanceDisconnected',
    };

    const registeredHandlers: Array<[string, (data: unknown) => void]> = [];

    for (const [event, callbackName] of Object.entries(eventMap)) {
      if (options[callbackName]) {
        const handler = (data: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (callbacksRef.current[callbackName] as ((d: any) => void) | undefined)?.(data);
        };
        socket.on(event, handler);
        registeredHandlers.push([event, handler]);
      }
    }

    return () => {
      stateSubscribers.delete(onState);
      for (const [event, handler] of registeredHandlers) {
        socket.off(event, handler);
      }
    };
  // Só roda uma vez por mount — callbacks são lidos via ref e não causam re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]);

  const subscribeToConversation = useCallback((customerId: string) => {
    if (sharedSocket && moduleAuthenticated) {
      sharedSocket.emit('subscribe_conversation', customerId);
    }
  }, []);

  const unsubscribeFromConversation = useCallback((customerId: string) => {
    if (sharedSocket) {
      sharedSocket.emit('unsubscribe_conversation', customerId);
    }
  }, []);

  const connect = useCallback(() => { ensureSocket(); }, []);

  const disconnect = useCallback(() => {
    if (sharedSocket) {
      sharedSocket.disconnect();
      sharedSocket = null;
      moduleAuthenticated = false;
    }
  }, []);

  return {
    isConnected,
    isAuthenticated,
    connect,
    disconnect,
    subscribeToConversation,
    unsubscribeFromConversation,
    socket: sharedSocket,
  };
}

// Hook especializado para mensagens de uma conversa específica
export function useConversationMessages(customerId: string | null) {
  const [messages, setMessages] = useState<unknown[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const handleNewMessage = useCallback((message: { customerId?: string }) => {
    if (message.customerId === customerId) {
      setMessages(prev => [...prev, message]);
    }
  }, [customerId]);

  const handleTyping = useCallback((data: { customerId: string; isTyping: boolean }) => {
    if (data.customerId === customerId) {
      setIsTyping(data.isTyping);
    }
  }, [customerId]);

  const { isConnected, isAuthenticated, subscribeToConversation, unsubscribeFromConversation } = useWebSocket({
    onNewMessage: handleNewMessage,
    onTyping: handleTyping,
  });

  useEffect(() => {
    if (isAuthenticated && customerId) {
      subscribeToConversation(customerId);
      return () => { unsubscribeFromConversation(customerId); };
    }
    return undefined;
  }, [isAuthenticated, customerId, subscribeToConversation, unsubscribeFromConversation]);

  return {
    messages,
    isTyping,
    isConnected,
    setMessages,
  };
}
