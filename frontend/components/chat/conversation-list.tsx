"use client";

import { ConversationSummary } from "@/types/message";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedCustomerId?: string | null;
  onSelectConversation: (customerId: string) => void;
}

export function ConversationList({ conversations, selectedCustomerId, onSelectConversation }: ConversationListProps) {
  const truncate = (text: string, maxLength = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

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

        return (
          <div
            key={conversation.customerId}
            onClick={() => onSelectConversation(conversation.customerId)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 border-b cursor-pointer transition-colors hover:bg-accent",
              selectedCustomerId === conversation.customerId && "bg-accent",
              needsHelp && "bg-yellow-50 dark:bg-yellow-900/10 border-l-2 border-l-yellow-500",
              isGroup && "bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-l-blue-500"
            )}
          >
            {/* Avatar Compacto */}
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
                needsHelp ? "bg-yellow-100 dark:bg-yellow-900/30" : isGroup ? "bg-blue-100 dark:bg-blue-900/30" : "bg-primary/10"
              )}
            >
              {conversation.customerProfilePic ? (
                <img
                  src={conversation.customerProfilePic}
                  alt={conversation.customerName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div className={cn("flex items-center justify-center", conversation.customerProfilePic ? "hidden" : "")}>
                {needsHelp ? (
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                ) : isGroup ? (
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-primary" />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{conversation.customerName}</h3>
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
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{formatTime(conversation.lastMessageTimestamp)}</span>
                  {conversation.unreadCount > 0 && (
                    <Badge className="h-4 w-4 flex items-center justify-center p-0 text-[10px]">{conversation.unreadCount}</Badge>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground truncate mt-0.5">{truncate(conversation.lastMessage, 40)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
