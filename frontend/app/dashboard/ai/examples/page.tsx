'use client';

import { useState, useEffect } from 'react';
import { ConversationExampleWithMessages } from '@/types/conversation-example';
import { conversationExampleApi } from '@/lib/conversation-example';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, Trash2, MessageSquare, Bot, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ExamplesPage() {
  const [examples, setExamples] = useState<ConversationExampleWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExample, setSelectedExample] = useState<ConversationExampleWithMessages | null>(null);
  const [removing, setRemoving] = useState(false);

  // Carrega os exemplos
  const loadExamples = async () => {
    try {
      const response = await conversationExampleApi.getExamples();
      setExamples(response.data);
    } catch (error) {
      console.error('Error loading examples:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamples();
  }, []);

  // Remove marcação de exemplo
  const handleRemove = async (conversationId: string) => {
    try {
      setRemoving(true);
      await conversationExampleApi.removeExample(conversationId);
      await loadExamples();
      setSelectedExample(null);
      alert('Exemplo removido com sucesso!');
    } catch (error: any) {
      console.error('Error removing example:', error);
      alert(error.response?.data?.message || 'Erro ao remover exemplo');
    } finally {
      setRemoving(false);
    }
  };

  // Formata data
  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return date;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Conversas Exemplares</h1>
        <p className="text-muted-foreground mt-2">
          Exemplos de conversas usados para treinar e melhorar as respostas da IA.
        </p>
      </div>

      {/* Lista de Exemplos */}
      {examples.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Star className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum exemplo marcado ainda</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Marque conversas exemplares no chat para que a IA possa aprender com elas e melhorar suas respostas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {examples.map((example) => (
            <Card key={example.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      <CardTitle className="text-lg">
                        {example.conversation.customer.name}
                      </CardTitle>
                      <Badge variant="outline">
                        {example.conversation.customer.phone}
                      </Badge>
                    </div>
                    <CardDescription>
                      Marcado em {formatDate(example.createdAt)}
                    </CardDescription>
                    {example.notes && (
                      <p className="text-sm mt-2 text-muted-foreground italic">
                        "{example.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedExample(example)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Ver Conversa
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemove(example.conversationId)}
                      disabled={removing}
                    >
                      {removing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {example.conversation.messages.length} mensagens
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal com Conversa Completa */}
      <Dialog open={!!selectedExample} onOpenChange={() => setSelectedExample(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Conversa Exemplar - {selectedExample?.conversation.customer.name}
            </DialogTitle>
            <DialogDescription>
              {selectedExample?.notes && (
                <span className="italic">"{selectedExample.notes}"</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {selectedExample?.conversation.messages.map((message) => {
                const isInbound = message.direction === 'INBOUND';
                const isAi = message.senderType === 'AI';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        isInbound
                          ? 'bg-muted text-foreground'
                          : isAi
                          ? 'bg-purple-500 text-white'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {!isInbound && (
                        <div className="flex items-center gap-1 mb-1">
                          {isAi ? (
                            <Badge variant="secondary" className="text-xs h-4">
                              <Bot className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs h-4">
                              <User className="h-3 w-3 mr-1" />
                              Humano
                            </Badge>
                          )}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p className="text-xs mt-1 opacity-70">
                        {format(new Date(message.timestamp), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedExample(null)}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedExample) {
                  handleRemove(selectedExample.conversationId);
                }
              }}
              disabled={removing}
            >
              {removing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover Exemplo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
