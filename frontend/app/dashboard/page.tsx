"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardStats, useDashboardCharts } from "@/hooks/use-dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatChangeBadge } from "@/components/dashboard/stat-change-badge";
import {
  PipelineFunnelChart,
  MessagesChart,
  AppointmentsChart,
  AppointmentsStatusChart,
  CustomerActivityChart,
} from "@/components/dashboard/charts";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { Users, MessageSquare, Bot, Activity } from "lucide-react";
import { cards, typography, spacing } from "@/lib/design-system";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";

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
  const router = useRouter();
  const [period] = useState<PeriodType>("week");
  const [chartPeriod] = useState<ChartPeriodType>("month");

  // Usa SWR para gerenciar stats com cache e refresh automático
  const { stats, isLoading, isError: statsError, mutate: refetchStats } = useDashboardStats(period);

  // Usa SWR para gerenciar charts data
  const { chartsData, isLoading: isLoadingCharts, isError: chartsError, mutate: refetchCharts } = useDashboardCharts(chartPeriod);

  // Transforma o objeto stats em um array para renderização
  const statCards = stats
    ? [
      {
        title: "Novos Clientes",
        value: stats.totalCustomers.current,
        percentageChange: stats.totalCustomers.percentageChange,
        icon: Users,
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        description: "Total de novos cadastros",
      },
      {
        title: "Conversas Ativas",
        value: stats.activeConversations.current,
        percentageChange: stats.activeConversations.percentageChange,
        icon: MessageSquare,
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        description: "Conversas com interação",
      },
      {
        title: "Mensagens Recebidas",
        value: stats.messagesReceived.current,
        percentageChange: stats.messagesReceived.percentageChange,
        icon: Activity,
        color: "text-orange-600",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        description: "Volume total de mensagens",
      },
      {
        title: "Respostas da IA",
        value: stats.messagesWithAI.current,
        percentageChange: stats.messagesWithAI.percentageChange,
        icon: Bot,
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        description: "Automação de respostas",
      },
    ]
    : [];

  // Loading state unificado
  const isPageLoading = (isLoading && !stats) || (isLoadingCharts && !chartsData);

  if (isPageLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats Skeletons */}
        <div className={`grid grid-cols-2 ${spacing.cardGap} lg:grid-cols-4`}>
          {[1, 2, 3, 4].map((i) => (
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
        <div className={`grid grid-cols-2 ${spacing.cardGap} lg:grid-cols-4 mb-6 sm:mb-8`}>
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
            {/* Primeira linha: Funil de Pipeline e Mensagens */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 mb-4 sm:mb-6">
              <PipelineFunnelChart data={chartsData.pipelineFunnel} />
              <MessagesChart data={chartsData.messagesOverTime} />
            </div>

            {/* Segunda linha: Agendamentos ao longo do tempo */}
            <div className="mb-4 sm:mb-6">
              <AppointmentsChart data={chartsData.appointmentsOverTime} />
            </div>

            {/* Terceira linha: Status de Agendamentos e Atividade de Clientes */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 mb-4 sm:mb-6">
              <AppointmentsStatusChart data={chartsData.appointmentsByStatus} />
              <CustomerActivityChart data={chartsData.customerActivity} />

              {/* Ações Rápidas */}
              <Card>
                <CardHeader>
                  <CardTitle>Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <button
                    onClick={() => router.push("/dashboard/customers")}
                    className="flex w-full items-center space-x-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <Users className="h-4 w-4" />
                    <span>Adicionar Cliente</span>
                  </button>
                  <NewConversationDialog
                    trigger={
                      <button className="flex w-full items-center space-x-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent">
                        <MessageSquare className="h-4 w-4" />
                        <span>Nova Conversa</span>
                      </button>
                    }
                    onConversationCreated={(customerId) => {
                      router.push(`/dashboard/conversations?customer=${customerId}`);
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}