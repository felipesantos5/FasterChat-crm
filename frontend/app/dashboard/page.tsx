"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";
import { useDashboardStats } from "@/hooks/use-dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatChangeBadge } from "@/components/dashboard/stat-change-badge";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { Users, MessageSquare, Bot, Activity, Loader2, LayoutDashboard } from "lucide-react";
import { cards, typography, spacing, icons } from "@/lib/design-system";

type PeriodType = "today" | "week" | "month";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [period] = useState<PeriodType>("week");

  // Usa SWR para gerenciar stats com cache e refresh automático
  const { stats, isLoading } = useDashboardStats(period);

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
          color: "text-purple-600",
          bgColor: "bg-purple-100 dark:bg-purple-900/30",
          description: "Automação de respostas",
        },
      ]
    : [];

  return (
    <div className={spacing.page}>
      <div className={spacing.section}>
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`${typography.pageTitle} flex items-center gap-3`}>
            <LayoutDashboard className={`${icons.large} text-purple-600`} />
            Dashboard
          </h1>
          <p className={typography.pageSubtitle}>
            Bem-vindo de volta, {user?.name}
          </p>
        </div>

        {/* Stats Grid */}
        {isLoading && !stats ? (
          <div className={`${cards.default} text-center py-16`}>
            <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
            <p className={`${typography.body} mt-4 text-gray-600`}>Carregando estatísticas...</p>
          </div>
        ) : (
          <div className={`grid ${spacing.cardGap} md:grid-cols-2 lg:grid-cols-4 mb-8`}>
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.title} className={cards.stats}>
                  <div className="flex items-center justify-between mb-4">
                    <p className={typography.caption}>{stat.title}</p>
                    <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                      <Icon className={`${icons.default} ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
                  <div className="flex items-center justify-between">
                    <p className={typography.caption}>
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
        )}

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Nenhuma atividade recente
            </div>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}