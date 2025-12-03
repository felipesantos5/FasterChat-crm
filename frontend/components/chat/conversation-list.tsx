'use client';

import { ConversationSummary, MessageDirection } from '@/types/message';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, AlertCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedCustomerId?: string | null;
  onSelectConversation: (customerId: string) => void;
}

export function ConversationList({
  conversations,
  selectedCustomerId,
  onSelectConversation,
}: ConversationListProps) {
  const truncate = (text: string, maxLength = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return '';
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhuma conversa
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {conversations.map((conversation) => {
        // Verifica se a conversa precisa de ajuda (quando a IA não consegue mais responder)
        const needsHelp = conversation.needsHelp;
        const isGroup = conversation.isGroup;

        return (
          <div
            key={conversation.customerId}
            onClick={() => onSelectConversation(conversation.customerId)}
            className={cn(
              'flex items-start gap-3 p-3 border-b cursor-pointer transition-colors hover:bg-accent',
              selectedCustomerId === conversation.customerId && 'bg-accent',
              needsHelp && 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500',
              isGroup && 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-500'
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
                needsHelp ? 'bg-yellow-100 dark:bg-yellow-900/30' : isGroup ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-primary/10'
              )}
            >
              {needsHelp ? (
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              ) : isGroup ? (
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <MessageSquare className="h-5 w-5 text-primary" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {conversation.customerName}
                  </h3>
                  {isGroup && (
                    <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs h-5 px-2 flex-shrink-0">
                      <Users className="h-3 w-3 mr-1" />
                      Grupo
                    </Badge>
                  )}
                  {needsHelp && (
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs h-5 px-2 flex-shrink-0">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Ajuda
                    </Badge>
                  )}
                </div>
                {conversation.unreadCount > 0 && (
                  <Badge className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs flex-shrink-0">
                    {conversation.unreadCount}
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-1 truncate">
                {truncate(conversation.lastMessage, 35)}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {formatTime(conversation.lastMessageTimestamp)}
                </span>
                {conversation.direction === MessageDirection.INBOUND && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">
                    Cliente
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
