"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatChangeBadge } from "@/components/dashboard/stat-change-badge";
import { dashboardApi, DashboardStats } from "@/lib/dashboard";
import { Users, MessageSquare, Bot, Activity, Loader2 } from "lucide-react";

type PeriodType = "today" | "week" | "month";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<PeriodType>("today");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardApi.getStats(period);
      setStats(data);
    } catch (err: any) {
      console.error("Error loading dashboard stats:", err);
      setError(err.response?.data?.message || "Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [period]);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, {user?.name}
        </p>
      </div>

      {/* Stats Grid */}
      {loading && !stats ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* CORREÇÃO AQUI: Usar statCards.map em vez de stats.map */}
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-full p-2 ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                    <StatChangeBadge 
                      percentageChange={stat.percentageChange} 
                      period={period} 
                    />
                  </div>
                </CardContent>
              </Card>
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
            <button className="flex w-full items-center space-x-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent">
              <Users className="h-4 w-4" />
              <span>Adicionar Cliente</span>
            </button>
            <button className="flex w-full items-center space-x-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent">
              <MessageSquare className="h-4 w-4" />
              <span>Nova Conversa</span>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}