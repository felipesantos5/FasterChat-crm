'use client';

import React, { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/components/ui/use-toast';

interface WebSocketContextType {
  isConnected: boolean;
  isAuthenticated: boolean;
  subscribeToConversation: (customerId: string) => void;
  unsubscribeFromConversation: (customerId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const handleNewMessage = useCallback((message: any) => {
    console.log('📩 New message received:', message);

    // Atualiza lista de conversas se necessário
    // Você pode adicionar lógica aqui para atualizar o estado global

    // Mostra notificação se a mensagem for INBOUND
    if (message.direction === 'INBOUND') {
      toast({
        title: `Nova mensagem de ${message.customerName}`,
        description: message.content.substring(0, 100),
      });
    }
  }, [toast]);

  const handleConversationUpdate = useCallback((update: any) => {
    console.log('🔄 Conversation updated:', update);

    // Mostra notificação se necessário
    if (update.needsHelp) {
      toast({
        title: 'Atenção necessária',
        description: `Cliente ${update.customerId} precisa de ajuda humana`,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const {
    isConnected,
    isAuthenticated,
    subscribeToConversation,
    unsubscribeFromConversation,
  } = useWebSocket({
    autoConnect: true,
    onNewMessage: handleNewMessage,
    onConversationUpdate: handleConversationUpdate,
  });

  // Log de status de conexão
  useEffect(() => {
    if (isConnected) {
      console.log('✅ WebSocket conectado');
    } else {
      console.log('🔌 WebSocket desconectado');
    }
  }, [isConnected]);

  useEffect(() => {
    if (isAuthenticated) {
      console.log('✅ WebSocket autenticado');
      toast({
        title: 'Conectado',
        description: 'Você está recebendo atualizações em tempo real',
      });
    }
  }, [isAuthenticated, toast]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        isAuthenticated,
        subscribeToConversation,
        unsubscribeFromConversation,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
