import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3030';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onNewMessage?: (message: any) => void;
  onConversationUpdate?: (update: any) => void;
  onTyping?: (data: { customerId: string; isTyping: boolean }) => void;
  onStatsUpdate?: (stats: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    onNewMessage,
    onConversationUpdate,
    onTyping,
    onStatsUpdate,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    console.log('[WebSocket] Connecting to', BACKEND_URL);

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('✅ [WebSocket] Connected:', socket.id);
      setIsConnected(true);

      // Autentica automaticamente se houver token
      const token = localStorage.getItem('token');
      if (token) {
        socket.emit('authenticate', token);
      }
    });

    socket.on('authenticated', (data) => {
      console.log('✅ [WebSocket] Authenticated:', data);
      setIsAuthenticated(true);
    });

    socket.on('auth_error', (error) => {
      console.error('❌ [WebSocket] Authentication error:', error);
      setIsAuthenticated(false);
    });

    socket.on('disconnect', () => {
      console.log('🔌 [WebSocket] Disconnected');
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Connection error:', error);
    });

    // Event listeners personalizados
    if (onNewMessage) {
      socket.on('new_message', onNewMessage);
    }

    if (onConversationUpdate) {
      socket.on('conversation_update', onConversationUpdate);
    }

    if (onTyping) {
      socket.on('typing', onTyping);
    }

    if (onStatsUpdate) {
      socket.on('stats_update', onStatsUpdate);
    }

    socketRef.current = socket;
  }, [onNewMessage, onConversationUpdate, onTyping, onStatsUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[WebSocket] Disconnecting...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsAuthenticated(false);
    }
  }, []);

  const subscribeToConversation = useCallback((customerId: string) => {
    if (socketRef.current && isAuthenticated) {
      console.log('[WebSocket] Subscribing to conversation:', customerId);
      socketRef.current.emit('subscribe_conversation', customerId);
    }
  }, [isAuthenticated]);

  const unsubscribeFromConversation = useCallback((customerId: string) => {
    if (socketRef.current && isAuthenticated) {
      console.log('[WebSocket] Unsubscribing from conversation:', customerId);
      socketRef.current.emit('unsubscribe_conversation', customerId);
    }
  }, [isAuthenticated]);

  // Auto-conecta se a opção estiver ativa
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    isAuthenticated,
    connect,
    disconnect,
    subscribeToConversation,
    unsubscribeFromConversation,
    socket: socketRef.current,
  };
}

// Hook especializado para mensagens de uma conversa específica
export function useConversationMessages(customerId: string | null) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const handleNewMessage = useCallback((message: any) => {
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

  // Se inscreve na conversa quando autenticado e customerId está disponível
  useEffect(() => {
    if (isAuthenticated && customerId) {
      subscribeToConversation(customerId);

      return () => {
        unsubscribeFromConversation(customerId);
      };
    }
    return undefined;
  }, [isAuthenticated, customerId, subscribeToConversation, unsubscribeFromConversation]);

  return {
    messages,
    isTyping,
    isConnected,
    setMessages, // Para permitir inicialização com mensagens existentes
  };
}
