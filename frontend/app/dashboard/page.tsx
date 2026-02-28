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
} from "@/components/dashboard/charts";
import { MessageSquare, UserPlus, MessageCircle } from "lucide-react";
import { spacing } from "@/lib/design-system";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useDashboardFilter } from "@/contexts/DashboardFilterContext";
// import { googleCalendarApi } from "@/lib/google-calendar";
// import { useAuthStore } from "@/lib/store/auth.store";

export default function DashboardPage() {
  return (
    <ProtectedPage requiredPage="DASHBOARD">
      <DashboardPageContent />
    </ProtectedPage>
  );
}

function DashboardPageContent() {
  // const router = useRouter();
  // const user = useAuthStore((state) => state.user);
  const { dateFilter } = useDashboardFilter();
  // const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);

  // Usa SWR para gerenciar stats com cache e refresh automático
  const { stats, isLoading, isError: statsError, mutate: refetchStats } = useDashboardStats(
    dateFilter.preset,
    dateFilter.customRange
  );

  // Usa SWR para gerenciar charts data
  const { chartsData, isLoading: isLoadingCharts, isError: chartsError, mutate: refetchCharts } = useDashboardCharts(
    dateFilter.preset,
    dateFilter.customRange
  );

  // Verifica se Google Calendar está conectado
  // useEffect(() => {
  //   async function checkGoogleCalendar() {
  //     if (!user?.companyId) {
  //       return;
  //     }

  //     try {
  //       const status = await googleCalendarApi.getStatus(user.companyId);
  //       // setIsGoogleCalendarConnected(status.connected);
  //     } catch (error) {
  //       console.error('[Dashboard] Error checking Google Calendar status:', error);
  //       // setIsGoogleCalendarConnected(false);
  //     }
  //   }

  //   checkGoogleCalendar();
  // }, [user?.companyId]);

  // Transforma o objeto stats em um array para renderização (3 cards)
  const statCards = stats
    ? [
      {
        title: "Novos Clientes",
        value: stats.totalCustomers?.current || 0,
        percentageChange: stats.totalCustomers?.percentageChange || 0,
        icon: UserPlus,
        gradient: "bg-gradient-to-br from-[#14522b] to-[#1a753a]",
        colorName: "green" as const,
        description: "",
      },
      {
        title: "Conversas Ativas",
        value: stats.activeConversations?.current || 0,
        percentageChange: stats.activeConversations?.percentageChange || 0,
        icon: MessageCircle,
        gradient: "bg-gradient-to-br from-[#209849] to-[#26bc58]",
        colorName: "green" as const,
        description: "",
      },
      {
        title: "Mensagens Recebidas",
        value: stats.messagesReceived?.current || 0,
        percentageChange: stats.messagesReceived?.percentageChange || 0,
        icon: MessageSquare,
        gradient: "bg-gradient-to-br from-[#0f311c] to-[#14522b]",
        colorName: "green" as const,
        description: "",
      },
    ]
    : [];

  // Loading state unificado
  const isPageLoading = (isLoading && !stats) || (isLoadingCharts && !chartsData);

  if (isPageLoading) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen space-y-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Linha 1: 3 stat cards + funil */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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

        {/* Linha 3: 4 cards bottom */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[280px] w-full rounded-2xl" />
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

  return (
    <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className={spacing.section}>
        <div className="flex flex-col gap-4 w-full mx-auto">
          {/* Linha 1: 3 Stat Cards + Funil (row-span-2) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* 3 Stat Cards */}
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

            {/* Gráfico de Mensagens - abaixo dos stat cards */}
            <div className="lg:col-span-3">
              {chartsData && (
                <ModernMessagesChart data={chartsData.messagesOverTime} />
              )}
            </div>
          </div>

          {/* Linha 3: Cards bottom, dinâmico dependendo do uso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {chartsData && (
              <>
                <ModernConversionCard data={chartsData.overallConversion} />
                <ModernPeakHoursChart data={chartsData.messagesByHour} />

                {chartsData.activeAppointments?.active > 0 && (
                  <ModernAppointmentsCard data={chartsData.activeAppointments} />
                )}

                {chartsData.batchEngagement?.hasBatchExecutions && (
                  <ModernBatchEngagementCard data={chartsData.batchEngagement} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}