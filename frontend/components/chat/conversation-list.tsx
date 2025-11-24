'use client';

import { ConversationSummary, MessageDirection } from '@/types/message';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare } from 'lucide-react';
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
      {conversations.map((conversation) => (
        <div
          key={conversation.customerId}
          onClick={() => onSelectConversation(conversation.customerId)}
          className={cn(
            'flex items-start gap-3 p-3 border-b cursor-pointer transition-colors hover:bg-accent',
            selectedCustomerId === conversation.customerId && 'bg-accent'
          )}
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm truncate">
                {conversation.customerName}
              </h3>
              {conversation.unreadCount > 0 && (
                <Badge className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
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
      ))}
    </div>
  );
}
