import { Skeleton } from "./skeleton";
import { Card } from "./card";

/**
 * Skeleton para cards de estatísticas do dashboard
 */
export function StatCardSkeleton() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-16 mb-2" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </Card>
  );
}

/**
 * Skeleton para gráficos
 */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <div className="p-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    </Card>
  );
}

/**
 * Skeleton para cards de clientes
 */
export function CustomerCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-1 mt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </Card>
  );
}

/**
 * Skeleton para linhas de tabela
 */
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  );
}

/**
 * Skeleton para lista de conversas
 */
export function ConversationItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border-b">
      <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/**
 * Skeleton para mensagens de chat
 */
export function MessageSkeleton({ isOutbound = false }: { isOutbound?: boolean }) {
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[70%] space-y-2 ${isOutbound ? "items-end" : "items-start"} flex flex-col`}>
        <Skeleton className="h-16 w-64 rounded-lg" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * Skeleton para formulários
 */
export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/**
 * Skeleton para seção completa de dashboard
 */
export function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Stats Skeletons */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts Skeletons */}
      <div className="grid gap-6 md:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <ChartSkeleton />
    </div>
  );
}

/**
 * Skeleton para grid de clientes
 */
export function CustomerGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <CustomerCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton para lista de conversas
 */
export function ConversationListSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <ConversationItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton para área de chat
 */
export function ChatAreaSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      <MessageSkeleton />
      <MessageSkeleton isOutbound />
      <MessageSkeleton />
      <MessageSkeleton isOutbound />
      <MessageSkeleton />
    </div>
  );
}

/**
 * Skeleton para calendário
 */
export function CalendarSkeleton() {
  return (
    <div className="h-full p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-24 w-full rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * Skeleton para pipeline/funil
 */
export function PipelineSkeleton() {
  return (
    <div className="h-full p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-80">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-8 rounded-full" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Card key={j} className="p-3">
                    <Skeleton className="h-5 w-full mb-2" />
                    <Skeleton className="h-4 w-24 mb-2" />
                    <div className="flex gap-1">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
