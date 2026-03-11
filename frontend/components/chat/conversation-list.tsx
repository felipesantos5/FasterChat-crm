"use client";

import { useState, useEffect } from "react";
import { ConversationSummary } from "@/types/message";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, AlertCircle, Users, Archive, Mic, User, Camera, ImageIcon, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedCustomerId?: string | null;
  onSelectConversation: (customerId: string) => void;
  aiThinkingIds?: Set<string>;
}

export function ConversationList({ conversations, selectedCustomerId, onSelectConversation, aiThinkingIds }: ConversationListProps) {
  // Força re-render a cada 5 minutos para atualizar os tempos relativos
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);



  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "";
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {conversations.map((conversation) => {
        const needsHelp = conversation.needsHelp;
        const isGroup = conversation.isGroup;
        const isArchived = conversation.isArchived;
        const isAiThinking = conversation.aiEnabled && (aiThinkingIds?.has(conversation.customerId) ?? false);

        return (
          <div
            key={conversation.customerId}
            onClick={() => onSelectConversation(conversation.customerId)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 border-b cursor-pointer transition-colors hover:bg-accent",
              selectedCustomerId === conversation.customerId && "bg-accent",
              needsHelp && "bg-yellow-50 dark:bg-yellow-900/10 border-l-2 border-l-yellow-500",
              isGroup && "bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-l-blue-500",
              isArchived && "opacity-95"
            )}
          >
            {/* Avatar Compacto */}
            <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden relative">
              {conversation.customerProfilePic ? (
                <img
                  src={conversation.customerProfilePic}
                  alt={conversation.customerName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div className={cn(
                "absolute inset-0 flex items-center justify-center rounded-full",
                conversation.customerProfilePic ? "hidden" : "",
                needsHelp ? "bg-yellow-100 dark:bg-yellow-900/30" : isGroup ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-200 dark:bg-gray-600"
              )}>
                {needsHelp ? (
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                ) : isGroup ? (
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <User className="h-5 w-5 text-gray-400 dark:text-gray-300" />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{conversation.customerName}</h3>
                  {conversation.pipelineStageColor && (
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: conversation.pipelineStageColor }}
                    />
                  )}
                  {isGroup && (
                    <Badge className="bg-blue-500 text-white text-[10px] h-4 px-1 flex-shrink-0">
                      Grupo
                    </Badge>
                  )}
                  {needsHelp && (
                    <Badge className="bg-yellow-500 text-white text-[10px] h-4 w-4 px-1 flex-shrink-0 items-center justify-center">
                      !
                    </Badge>
                  )}
                  {isArchived && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 flex-shrink-0">
                      <Archive className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                </div>
                <div className="relative flex flex-col items-end flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{formatTime(conversation.lastMessageTimestamp)}</span>
                  {conversation.unreadCount > 0 && !isArchived && (
                    <span
                      className="absolute top-full mt-[4px] right-0 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                      title="Mensagens não lidas"
                    >
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>

              {isAiThinking ? (
                <p className="text-xs mt-0.5 flex items-center gap-1 text-violet-600 dark:text-violet-400 font-medium">
                  <Bot className="h-3 w-3 shrink-0" />
                  IA pensando
                  <span className="flex gap-0.5 items-center">
                    <span className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                  {conversation.direction === "OUTBOUND" && (
                    <span className="text-teal-600 dark:text-teal-400 font-medium shrink-0">Você: </span>
                  )}
                  {conversation.lastMediaType === "video" || conversation.lastMessage.toLowerCase().startsWith("[video") ? (
                    <span className="flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5 shrink-0" />
                      Vídeo
                    </span>
                  ) : conversation.lastMediaType === "image" || conversation.lastMessage.toLowerCase().startsWith("[imagem") ? (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                      Imagem
                    </span>
                  ) : conversation.lastMediaType === "audio" || conversation.lastMessage.toLowerCase().startsWith("[audio") ? (
                    <span className="flex items-center gap-1">
                      <Mic className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {(() => {
                        const msg = conversation.lastMessage.toLowerCase();
                        const match = msg.match(/\[audio:\s*(.+?)\]/);
                        return match && match[1] ? match[1] : "Áudio";
                      })()}
                    </span>
                  ) : (
                    <span className="truncate">{conversation.lastMessage}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
