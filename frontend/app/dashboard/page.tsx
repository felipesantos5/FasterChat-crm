"use client";

import { useState } from "react";
import { useDashboardStats, useDashboardCharts } from "@/hooks/use-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { StatChangeBadge } from "@/components/dashboard/stat-change-badge";
import {
  PipelineFunnelChart,
  MessagesChart,
} from "@/components/dashboard/charts";
import { Users, MessageSquare, Bot, Activity, Calendar, CalendarCheck, CalendarClock, AlertTriangle } from "lucide-react";
import { cards, typography, spacing } from "@/lib/design-system";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
// import { googleCalendarApi } from "@/lib/google-calendar";
// import { useAuthStore } from "@/lib/store/auth.store";

type PeriodType = "today" | "week" | "month";
type ChartPeriodType = "week" | "month" | "quarter";

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
  const [period] = useState<PeriodType>("week");
  const [chartPeriod] = useState<ChartPeriodType>("month");
  // const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);

  // Usa SWR para gerenciar stats com cache e refresh automático
  const { stats, isLoading, isError: statsError, mutate: refetchStats } = useDashboardStats(period);

  // Usa SWR para gerenciar charts data
  const { chartsData, isLoading: isLoadingCharts, isError: chartsError, mutate: refetchCharts } = useDashboardCharts(chartPeriod);

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
        icon: Users,
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        description: "Total de novos cadastros",
      },
      {
        title: "Conversas Ativas",
        value: stats.activeConversations?.current || 0,
        percentageChange: stats.activeConversations?.percentageChange || 0,
        icon: MessageSquare,
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        description: "Conversas com interação",
      },
      {
        title: "Mensagens Recebidas",
        value: stats.messagesReceived?.current || 0,
        percentageChange: stats.messagesReceived?.percentageChange || 0,
        icon: Activity,
        color: "text-orange-600",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        description: "Volume total de mensagens",
      },
      {
        title: "Respostas da IA",
        value: stats.messagesWithAI?.current || 0,
        percentageChange: stats.messagesWithAI?.percentageChange || 0,
        icon: Bot,
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        description: "Automação de respostas",
      },
      {
        title: "Transbordos",
        value: stats.handoffConversations?.current || 0,
        percentageChange: stats.handoffConversations?.percentageChange || 0,
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        description: "IA transferiu para humano",
      },
      {
        title: "Agendamentos Totais",
        value: stats.totalAppointments?.current || 0,
        percentageChange: stats.totalAppointments?.percentageChange || 0,
        icon: Calendar,
        color: "text-purple-600",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
        description: "Total de agendamentos",
      },
      {
        title: "Agendamentos Hoje",
        value: stats.todayAppointments?.current || 0,
        percentageChange: stats.todayAppointments?.percentageChange || 0,
        icon: CalendarCheck,
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        description: "Agendamentos de hoje",
      },
      {
        title: "Próximos 7 Dias",
        value: stats.upcomingAppointments?.current || 0,
        percentageChange: stats.upcomingAppointments?.percentageChange || 0,
        icon: CalendarClock,
        color: "text-orange-600",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        description: "Agendamentos futuros",
      }
    ]
    : [];

  // Loading state unificado
  const isPageLoading = (isLoading && !stats) || (isLoadingCharts && !chartsData);

  if (isPageLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats Skeletons */}
        <div className={`grid grid-cols-2 ${spacing.cardGap} lg:grid-cols-3`}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className={cards.stats}>
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-16 mb-2" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Skeletons */}
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
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
    <div className="p-4 sm:p-6">
      <div className={spacing.section}>
        {/* Stats Grid */}
        <div className={`grid grid-cols-2 ${spacing.cardGap} lg:grid-cols-3 xl:grid-cols-4 mb-4 sm:mb-6`}>
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.title} className={cards.stats}>
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <p className={`${typography.caption} text-xs sm:text-sm`}>{stat.title}</p>
                  <div className={`rounded-lg sm:rounded-xl p-2 sm:p-3 ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{stat.value}</p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <p className={`${typography.caption} text-xs hidden sm:block`}>
                    {stat.description}
                  </p>
                  <StatChangeBadge
                    percentageChange={stat.percentageChange}
                    period={period}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Section */}
        {chartsData ? (
          <>
            {/* Primeira linha: Mensagens (grande) + Funil e Atividade (menores) */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-12 mb-4 sm:mb-6">
              {/* Gráfico de Mensagens - Ocupa 7 colunas (maior destaque) */}
              <div className="lg:col-span-7">
                <MessagesChart data={chartsData.messagesOverTime} />
              </div>

              {/* Coluna lateral com Funil e Atividade */}
              <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
                {/* Funil de Pipeline */}
                <PipelineFunnelChart data={chartsData.pipelineFunnel} />

                {/* Atividade de Clientes - Compacto (max 320px altura) */}
                {/* <div className="max-h-[320px]">
                  <CustomerActivityChart data={chartsData.customerActivity} />
                </div> */}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}