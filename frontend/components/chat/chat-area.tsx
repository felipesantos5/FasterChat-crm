"use client";

import { useState, useEffect, useRef } from "react";
import { Message, MessageDirection, SenderType } from "@/types/message";
import { Conversation } from "@/types/conversation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { messageApi } from "@/lib/message";
import { conversationApi } from "@/lib/conversation";
import { conversationExampleApi } from "@/lib/conversation-example";
import { Send, Loader2, MessageSquare, Bot, User as UserIcon, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageFeedbackComponent } from "@/components/chat/message-feedback";

interface ChatAreaProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
}

export function ChatArea({ customerId, customerName, customerPhone }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isExample, setIsExample] = useState(false);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [exampleNotes, setExampleNotes] = useState("");
  const [markingExample, setMarkingExample] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Obtém userId do usuário logado
  const getUserId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.id;
    }
    return null;
  };

  // Obtém companyId do usuário logado
  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Carrega conversa
  const loadConversation = async () => {
    try {
      const companyId = getCompanyId();
      if (!companyId) return;

      const response = await conversationApi.getConversation(customerId, companyId);
      setConversation(response.data);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  // Carrega mensagens
  const loadMessages = async () => {
    try {
      const response = await messageApi.getCustomerMessages(customerId, 100);
      // Backend já retorna ordenado por timestamp ascendente (cronologia correta)
      const messages = response.data.messages;

      // Verifica se há mensagem recente do cliente sem resposta da IA
      const lastMessage = messages[messages.length - 1];
      if (conversation?.aiEnabled && lastMessage?.direction === MessageDirection.INBOUND) {
        // Verifica se há resposta da IA depois dessa mensagem
        const hasAiResponse = messages.some(
          (msg, idx) => idx > messages.length - 1 && msg.direction === MessageDirection.OUTBOUND && msg.senderType === SenderType.AI
        );
        setAiProcessing(!hasAiResponse && Date.now() - new Date(lastMessage.timestamp).getTime() < 30000);
      } else {
        setAiProcessing(false);
      }

      setMessages(messages);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Verifica se a conversa está marcada como exemplo
  const checkIsExample = async () => {
    if (!conversation?.id) return;
    try {
      const response = await conversationExampleApi.isExample(conversation.id);
      setIsExample(response.data.isExample);
    } catch (error) {
      console.error("Error checking if is example:", error);
    }
  };

  useEffect(() => {
    loadConversation();
    loadMessages();

    // Polling: atualiza a cada 3 segundos
    const interval = setInterval(() => {
      loadConversation();
      loadMessages();
    }, 3000);

    return () => clearInterval(interval);
  }, [customerId]);

  useEffect(() => {
    if (conversation?.id) {
      checkIsExample();
    }
  }, [conversation?.id]);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    setInputValue("");
    setSending(true);

    try {
      const response = await messageApi.sendMessage(customerId, messageContent, "HUMAN");

      // Adiciona a mensagem enviada à lista
      setMessages((prev) => [...prev, response.data.message]);

      // Recarrega mensagens para garantir sincronia
      setTimeout(loadMessages, 500);
    } catch (error: any) {
      console.error("Error sending message:", error);
      alert(error.response?.data?.message || "Erro ao enviar mensagem");
      setInputValue(messageContent); // Restaura o texto
    } finally {
      setSending(false);
    }
  };

  // Assume conversa
  const handleAssignConversation = async () => {
    try {
      setAssigning(true);
      const userId = getUserId();
      if (!userId) {
        alert("Usuário não encontrado");
        return;
      }

      await conversationApi.assignConversation(customerId, userId);
      await loadConversation();
    } catch (error: any) {
      console.error("Error assigning conversation:", error);
      alert(error.response?.data?.message || "Erro ao assumir conversa");
    } finally {
      setAssigning(false);
    }
  };

  // Libera conversa para IA
  const handleUnassignConversation = async () => {
    try {
      setAssigning(true);
      await conversationApi.unassignConversation(customerId);
      await loadConversation();
    } catch (error: any) {
      console.error("Error unassigning conversation:", error);
      alert(error.response?.data?.message || "Erro ao liberar conversa");
    } finally {
      setAssigning(false);
    }
  };

  // Toggle IA
  const handleToggleAi = async () => {
    try {
      setTogglingAi(true);
      const newAiState = !conversation?.aiEnabled;
      await conversationApi.toggleAI(customerId, newAiState);
      await loadConversation();
    } catch (error: any) {
      console.error("Error toggling AI:", error);
      alert(error.response?.data?.message || "Erro ao alterar estado da IA");
    } finally {
      setTogglingAi(false);
    }
  };

  // Abre modal para marcar como exemplo
  const handleOpenExampleModal = () => {
    setShowExampleModal(true);
    setExampleNotes("");
  };

  // Marca/desmarca conversa como exemplo
  const handleMarkAsExample = async () => {
    if (!conversation?.id) return;

    try {
      setMarkingExample(true);

      if (isExample) {
        // Remove marcação
        await conversationExampleApi.removeExample(conversation.id);
        setIsExample(false);
        alert("Conversa desmarcada como exemplo");
      } else {
        // Marca como exemplo
        await conversationExampleApi.markAsExample(conversation.id, exampleNotes);
        setIsExample(true);
        setShowExampleModal(false);
        alert("Conversa marcada como exemplo com sucesso!");
      }
    } catch (error: any) {
      console.error("Error marking as example:", error);
      alert(error.response?.data?.message || "Erro ao marcar conversa como exemplo");
    } finally {
      setMarkingExample(false);
    }
  };

  // Submete feedback de uma mensagem
  const handleFeedbackSubmit = async (messageId: string, feedback: "GOOD" | "BAD", note?: string) => {
    try {
      await messageApi.addFeedback(messageId, feedback, note);

      // Atualiza a mensagem localmente
      setMessages((prevMessages) =>
        prevMessages.map((msg) => (msg.id === messageId ? { ...msg, feedback: feedback as any, feedbackNote: note || null } : msg))
      );
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      alert(error.response?.data?.message || "Erro ao enviar feedback");
      throw error;
    }
  };

  // Formata timestamp
  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAiEnabled = conversation?.aiEnabled ?? false;
  const assignedUser = conversation?.assignedTo;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">{customerName}</h2>
            {isAiEnabled ? (
              <Badge className="bg-purple-500 hover:bg-purple-600">
                <Bot className="h-3 w-3 mr-1" />
                IA Ativa
              </Badge>
            ) : (
              <Badge variant="secondary">
                <UserIcon className="h-3 w-3 mr-1" />
                {assignedUser ? assignedUser.name : "Humano"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{customerPhone}</p>
        </div>

        {/* Toggle de IA e Botões de Ação */}
        <div className="flex items-center gap-4">
          {/* Toggle IA */}
          <div className="flex items-center gap-2">
            <Switch id="ai-toggle" checked={isAiEnabled} onCheckedChange={handleToggleAi} disabled={togglingAi} />
            <Label htmlFor="ai-toggle" className="text-sm cursor-pointer">
              {togglingAi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isAiEnabled ? (
                <span className="flex items-center gap-1">
                  <Bot className="h-4 w-4" />
                  IA Ativa
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <UserIcon className="h-4 w-4" />
                  Atendimento Manual
                </span>
              )}
            </Label>
          </div>

          {/* Botão Marcar como Exemplo */}
          <Button
            onClick={isExample ? handleMarkAsExample : handleOpenExampleModal}
            disabled={markingExample}
            size="sm"
            variant={isExample ? "default" : "outline"}
            className={isExample ? "bg-yellow-500 hover:bg-yellow-600" : ""}
          >
            {markingExample ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Star className={cn("h-4 w-4 mr-2", isExample && "fill-current")} />
            )}
            {isExample ? "Remover Exemplo" : "Marcar como Exemplo"}
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para começar a conversa</p>
          </div>
        ) : (
          messages.map((message) => {
            const isInbound = message.direction === MessageDirection.INBOUND;
            const isAi = message.senderType === SenderType.AI;

            return (
              <div key={message.id} className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-4 py-2",
                    isInbound ? "bg-muted text-foreground" : isAi ? "bg-purple-500 text-white" : "bg-primary text-primary-foreground"
                  )}
                >
                  {!isInbound && (
                    <div className="flex items-center gap-1 mb-1">
                      {isAi ? (
                        <Badge variant="secondary" className="text-xs h-4">
                          <Bot className="h-3 w-3 mr-1" />
                          IA
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs h-4 bg-white">
                          <UserIcon className="h-3 w-3 mr-1" />
                          Você
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {message.mediaType === 'image' && message.mediaUrl && (
                      <img 
                        src={message.mediaUrl} 
                        alt="Imagem enviada" 
                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => message.mediaUrl && window.open(message.mediaUrl, '_blank')}
                      />
                    )}
                    
                    {(message.mediaType === 'audio' || message.content.startsWith('[Áudio]')) && (
                      <div className="flex items-center gap-2 bg-secondary/50 p-2 rounded-md min-w-[200px]">
                        {message.mediaUrl ? (
                          <audio controls className="w-full h-8">
                            <source src={message.mediaUrl} type="audio/ogg" />
                            <source src={message.mediaUrl} type="audio/mpeg" />
                            <source src={message.mediaUrl} type="audio/mp4" />
                            Seu navegador não suporta áudio.
                          </audio>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="text-xs">Áudio indisponível para reprodução</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Só mostra o conteúdo de texto se não for apenas o marcador de áudio/imagem ou se tiver transcrição */}
                    {message.content && !message.content.startsWith('[Áudio]') && !message.content.startsWith('[Imagem]') && (
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className={cn("text-xs", isInbound ? "text-muted-foreground" : "text-white/70")}>{formatMessageTime(message.timestamp)}</p>
                    {/* Mostra feedback apenas para mensagens da IA */}
                    {!isInbound && isAi && (
                      <MessageFeedbackComponent
                        messageId={message.id}
                        currentFeedback={message.feedback}
                        currentNote={message.feedbackNote}
                        onFeedbackSubmit={handleFeedbackSubmit}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* AI Processing Indicator */}
        {aiProcessing && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-lg px-4 py-2 bg-purple-100 dark:bg-purple-900/30">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <div className="flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
                    ●
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
                    ●
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
                    ●
                  </span>
                </div>
                <span className="text-sm text-purple-600 dark:text-purple-400">IA está pensando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-4 border-t bg-muted/30">
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
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {/* Modal para Marcar como Exemplo */}
      <Dialog open={showExampleModal} onOpenChange={setShowExampleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Conversa como Exemplo</DialogTitle>
            <DialogDescription>
              Esta conversa será usada como referência para a IA aprender o tom e estilo de atendimento ideal. Você pode adicionar uma nota opcional
              para documentar por que esta conversa é um bom exemplo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="example-notes">Nota (Opcional)</Label>
              <Textarea
                id="example-notes"
                placeholder="Ex: Ótimo exemplo de como lidar com reclamações, tom empático e resolução rápida."
                value={exampleNotes}
                onChange={(e) => setExampleNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExampleModal(false)} disabled={markingExample}>
              Cancelar
            </Button>
            <Button onClick={handleMarkAsExample} disabled={markingExample} className="bg-yellow-500 hover:bg-yellow-600">
              {markingExample ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Marcando...
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Marcar como Exemplo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
