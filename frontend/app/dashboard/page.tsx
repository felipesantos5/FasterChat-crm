"use client";

import { useDashboardStats, useDashboardCharts } from "@/hooks/use-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { ModernStatCard } from "@/components/dashboard/modern-stat-card";
import {
  ModernMessagesChart,
  ModernFunnelDonut,
  ModernVolumeBars,
  ActivityHeatmap,
  TopCustomersList,
} from "@/components/dashboard/charts";
import { Users, MessageSquare, Bot, Activity, Calendar, CalendarCheck, UserPlus, MessageCircle } from "lucide-react";
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

  // Transforma o objeto stats em um array para renderização
  const statCards = stats
    ? [
      {
        title: "Novos Clientes",
        value: stats.totalCustomers?.current || 0,
        percentageChange: stats.totalCustomers?.percentageChange || 0,
        icon: UserPlus,
        gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
        description: "Total de novos cadastros",
      },
      {
        title: "Conversas Ativas",
        value: stats.activeConversations?.current || 0,
        percentageChange: stats.activeConversations?.percentageChange || 0,
        icon: MessageCircle,
        gradient: "bg-gradient-to-br from-green-500 to-green-600",
        description: "Conversas com interação",
      },
      {
        title: "Mensagens Recebidas",
        value: stats.messagesReceived?.current || 0,
        percentageChange: stats.messagesReceived?.percentageChange || 0,
        icon: MessageSquare,
        gradient: "bg-gradient-to-br from-orange-500 to-orange-600",
        description: "Volume total de mensagens",
      },
      {
        title: "Respostas da IA",
        value: stats.messagesWithAI?.current || 0,
        percentageChange: stats.messagesWithAI?.percentageChange || 0,
        icon: Bot,
        gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
        description: "Automação de respostas",
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

        {/* Stats Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        {/* Charts Skeletons */}
        <Skeleton className="h-96 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
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
        <section className="flex gap-6 w-full">
          {/* Primeira linha: Cards (2x2) à esquerda + Funil à direita */}
          <div className="flex flex-col gap-6 w-full">
            {/* Cards em grid 2x2 */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat) => (
                <ModernStatCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  percentageChange={stat.percentageChange}
                  icon={stat.icon}
                  gradient={stat.gradient}
                  description={stat.description}
                />
              ))}
            </div>

            {/* Funil de Vendas */}
            {chartsData && (
              <div className="mb-6">
                <ModernMessagesChart data={chartsData.messagesOverTime} />
              </div>
            )}
          </div>

          {/* {chartsData ? (
          <>
            <div className="mb-6">
              <ModernVolumeBars data={chartsData.messagesOverTime} />
            </div>
          </>
        ) : null} */}
          <div className="max-w-[25%] w-full">
            {chartsData && (

              <ModernFunnelDonut data={chartsData.pipelineFunnel} />

            )}
          </div>
        </section>
      </div>
    </div>
  );
}