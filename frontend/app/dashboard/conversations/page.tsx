'use client';

import { useState, useEffect } from 'react';
import { ConversationList } from '@/components/chat/conversation-list';
import { ChatArea } from '@/components/chat/chat-area';
import { CustomerDetails } from '@/components/chat/customer-details';
import { messageApi } from '@/lib/message';
import { ConversationSummary } from '@/types/message';
import { Loader2, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Obtém o companyId do usuário logado
  const getCompanyId = () => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Carrega as conversas
  const loadConversations = async () => {
    try {
      setError(null);
      const companyId = getCompanyId();

      if (!companyId) {
        setError('Empresa não encontrada');
        return;
      }

      const response = await messageApi.getConversations(companyId);
      setConversations(response.data);

      // Se não há conversa selecionada e há conversas, seleciona a primeira
      if (!selectedCustomerId && response.data.length > 0) {
        setSelectedCustomerId(response.data[0].customerId);
      }
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError(err.response?.data?.message || 'Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();

    // Polling: atualiza a cada 5 segundos
    const interval = setInterval(() => {
      loadConversations();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Encontra a conversa selecionada
  const selectedConversation = conversations.find(
    (c) => c.customerId === selectedCustomerId
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Coluna 1: Lista de Conversas (250px) */}
      <div className="w-[250px] border-r bg-background overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold text-sm">Conversas</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Aguarde mensagens dos clientes
              </p>
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedCustomerId={selectedCustomerId}
              onSelectConversation={setSelectedCustomerId}
            />
          )}
        </div>
      </div>

      {/* Coluna 2: Área de Chat (flex-1) */}
      <div className="flex-1 bg-background overflow-hidden">
        {selectedConversation ? (
          <ChatArea
            customerId={selectedConversation.customerId}
            customerName={selectedConversation.customerName}
            customerPhone={selectedConversation.customerPhone}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Selecione uma conversa
            </h3>
            <p className="text-sm text-muted-foreground">
              Escolha uma conversa da lista para começar a visualizar as mensagens
            </p>
          </div>
        )}
      </div>

      {/* Coluna 3: Detalhes do Cliente (300px) */}
      {selectedConversation && (
        <div className="w-[300px] border-l bg-background overflow-hidden">
          <CustomerDetails
            customerId={selectedConversation.customerId}
            customerName={selectedConversation.customerName}
            customerPhone={selectedConversation.customerPhone}
          />
        </div>
      )}
    </div>
  );
}
