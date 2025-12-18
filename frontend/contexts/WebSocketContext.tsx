'use client';

import React, { createContext, useContext, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/components/ui/use-toast';
import { notificationSound } from '@/lib/notification-sound';

interface WebSocketContextType {
  isConnected: boolean;
  isAuthenticated: boolean;
  subscribeToConversation: (customerId: string) => void;
  unsubscribeFromConversation: (customerId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  // Guarda IDs de conversas que já notificaram transbordo para evitar repetição
  const notifiedTransbordos = useRef<Set<string>>(new Set());

  const handleNewMessage = useCallback((message: any) => {
    // Mostra notificação se a mensagem for INBOUND e não for de um grupo
    if (message.direction === 'INBOUND' && !message.isGroup) {
      // Som suave para nova mensagem
      notificationSound.playNewMessageSound();

      toast({
        title: `Nova mensagem de ${message.customerName}`,
        description: message.content?.substring(0, 100) || 'Nova mensagem',
      });
    }
  }, [toast]);

  const handleConversationUpdate = useCallback((update: any) => {
    // Notificação de transbordo (needsHelp = true)
    if (update.needsHelp) {
      const conversationKey = update.customerId || update.id;

      // Evita notificações duplicadas para a mesma conversa
      if (conversationKey && !notifiedTransbordos.current.has(conversationKey)) {
        notifiedTransbordos.current.add(conversationKey);

        // Toca som de alerta de transbordo
        notificationSound.playTransbordoAlert();

        toast({
          title: '🚨 Transbordo - Atenção necessária',
          description: update.customerName
            ? `Cliente ${update.customerName} precisa de atendimento humano`
            : 'Um cliente precisa de ajuda humana',
          variant: 'destructive',
        });

        // Remove da lista após 5 minutos para permitir nova notificação
        setTimeout(() => {
          notifiedTransbordos.current.delete(conversationKey);
        }, 5 * 60 * 1000);
      }
    } else if (update.needsHelp === false) {
      // Se needsHelp foi resolvido, remove da lista
      const conversationKey = update.customerId || update.id;
      if (conversationKey) {
        notifiedTransbordos.current.delete(conversationKey);
      }
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

  // Notificação de conexão
  useEffect(() => {
    if (isAuthenticated) {
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

