'use client';

import { useState, useEffect, useRef } from 'react';
import { Message, MessageDirection } from '@/types/message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { messageApi } from '@/lib/message';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatAreaProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
}

export function ChatArea({ customerId, customerName, customerPhone }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega mensagens
  const loadMessages = async () => {
    try {
      const response = await messageApi.getCustomerMessages(customerId, 100);
      // Ordena por timestamp ascendente (mais antigas primeiro)
      const sortedMessages = response.data.messages.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setMessages(sortedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    // Polling: atualiza a cada 3 segundos
    const interval = setInterval(loadMessages, 3000);

    return () => clearInterval(interval);
  }, [customerId]);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus no input ao carregar
  useEffect(() => {
    inputRef.current?.focus();
  }, [customerId]);

  // Envia mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || sending) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setSending(true);

    try {
      const response = await messageApi.sendMessage(customerId, messageContent, 'HUMAN');

      // Adiciona a mensagem enviada à lista
      setMessages((prev) => [...prev, response.data.message]);

      // Recarrega mensagens para garantir sincronia
      setTimeout(loadMessages, 500);
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.response?.data?.message || 'Erro ao enviar mensagem');
      setInputValue(messageContent); // Restaura o texto
    } finally {
      setSending(false);
    }
  };

  // Formata timestamp
  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div>
          <h2 className="font-semibold text-lg">{customerName}</h2>
          <p className="text-sm text-muted-foreground">{customerPhone}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          Online
        </Badge>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Envie uma mensagem para começar a conversa
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isInbound = message.direction === MessageDirection.INBOUND;

            return (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  isInbound ? 'justify-start' : 'justify-end'
                )}
              >
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-4 py-2',
                    isInbound
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <p
                    className={cn(
                      'text-xs mt-1',
                      isInbound
                        ? 'text-muted-foreground'
                        : 'text-primary-foreground/70'
                    )}
                  >
                    {formatMessageTime(message.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="flex items-center gap-2 p-4 border-t bg-muted/30"
      >
        <Input
          ref={inputRef}
          type="text"
          placeholder="Digite sua mensagem..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !inputValue.trim()} size="icon">
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
