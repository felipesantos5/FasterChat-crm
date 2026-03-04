"use client";

import { useDashboardStats, useDashboardCharts } from "@/hooks/use-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { ModernStatCard } from "@/components/dashboard/modern-stat-card";
import {
  ModernMessagesChart,
  ModernFunnelDonut,
  ModernPeakHoursChart,
  ModernAppointmentsCard,
  ModernConversionCard,
  ModernBatchEngagementCard,
  ModernRegionChart,
} from "@/components/dashboard/charts";
import { MessageSquare, UserPlus, MessageCircle } from "lucide-react";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useDashboardFilter } from "@/contexts/DashboardFilterContext";

export default function DashboardPage() {
  return (
    <ProtectedPage requiredPage="DASHBOARD">
      <DashboardPageContent />
    </ProtectedPage>
  );
}

function DashboardPageContent() {
  const { dateFilter } = useDashboardFilter();

  const { stats, isLoading, isError: statsError, mutate: refetchStats } = useDashboardStats(
    dateFilter.preset,
    dateFilter.customRange
  );

  const { chartsData, isLoading: isLoadingCharts, isError: chartsError, mutate: refetchCharts } = useDashboardCharts(
    dateFilter.preset,
    dateFilter.customRange
  );

  const statCards = stats
    ? [
      {
        title: "Novos Clientes",
        value: stats.totalCustomers?.current || 0,
        percentageChange: stats.totalCustomers?.percentageChange || 0,
        icon: UserPlus,
        gradient: "bg-gradient-to-br from-[#7dd0a0] to-[#5dc97e]",
        colorName: "lime" as const,
        description: "",
      },
      {
        title: "Conversas Ativas",
        value: stats.activeConversations?.current || 0,
        percentageChange: stats.activeConversations?.percentageChange || 0,
        icon: MessageCircle,
        gradient: "bg-gradient-to-br from-[#5dc97e] to-[#44ba6c]",
        colorName: "emerald" as const,
        description: "",
      },
      {
        title: "Mensagens Recebidas",
        value: stats.messagesReceived?.current || 0,
        percentageChange: stats.messagesReceived?.percentageChange || 0,
        icon: MessageSquare,
        gradient: "bg-gradient-to-br from-[#2d9a53] to-[#1e713b]",
        colorName: "teal" as const,
        description: "",
      },
    ]
    : [];

  const isPageLoading = (isLoading && !stats) || (isLoadingCharts && !chartsData);

  if (isPageLoading) {
    return (
      <div className="h-full flex flex-col gap-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between flex-none">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-none">
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[400px] w-full rounded-2xl lg:row-span-2" />
          <div className="lg:col-span-3">
            <Skeleton className="h-[300px] w-full rounded-2xl" />
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-full w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (statsError || chartsError) {
    return (
      <LoadingErrorState
        resource="dashboard"
        onRetry={() => {
          refetchStats();
          refetchCharts();
        }}
      />
    );
  }

  // Coleta os cards de baixo dinamicamente, máximo 4
  const bottomCards = chartsData
    ? [
      <ModernConversionCard key="conversion" data={chartsData.overallConversion} />,
      <ModernPeakHoursChart key="peak" data={chartsData.messagesByHour} />,
      ...(chartsData.activeAppointments?.active > 0
        ? [<ModernAppointmentsCard key="appointments" data={chartsData.activeAppointments} />]
        : []),
      ...(chartsData.clientsByState && chartsData.clientsByState.length > 1
        ? [<ModernRegionChart key="region" data={chartsData.clientsByState} />]
        : []),
      ...(chartsData.batchEngagement?.hasBatchExecutions
        ? [<ModernBatchEngagementCard key="batch" data={chartsData.batchEngagement} />]
        : []),
    ].slice(0, 4)
    : [];

  // Classe de colunas para desktop — sempre preenche a linha inteira
  const bottomColClass = (
    {
      1: "lg:grid-cols-1",
      2: "lg:grid-cols-2",
      3: "lg:grid-cols-3",
      4: "lg:grid-cols-4",
    } as Record<number, string>
  )[bottomCards.length] ?? "lg:grid-cols-4";

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Linha 1: 3 Stat Cards + Funil (row-span-2) + Gráfico de Mensagens */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 flex-none">
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map((stat) => (
              <ModernStatCard
                key={stat.title}
                title={stat.title}
                value={stat.value}
                percentageChange={stat.percentageChange}
                icon={stat.icon}
                gradient={stat.gradient}
                description={stat.description}
                colorName={stat.colorName}
              />
            ))}
          </div>

          {/* Funil de Vendas - row-span-2 */}
          <div className="lg:row-span-2">
            {chartsData && (
              <ModernFunnelDonut data={chartsData.pipelineFunnel} />
            )}
          </div>

          {/* Gráfico de Mensagens */}
          <div className="lg:col-span-3">
            {chartsData && (
              <ModernMessagesChart data={chartsData.messagesOverTime} />
            )}
          </div>
        </div>

        {/* Linha 2: Cards bottom — preenche o restante da tela, colunas dinâmicas */}
        <div className={`flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 ${bottomColClass} gap-4`}>
          {bottomCards}
        </div>
      </div>
    </div>
  );
}
