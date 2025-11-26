"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const getPeriodLabel = (p: PeriodType) => {
    switch (p) {
      case "today":
        return "Hoje";
      case "week":
        return "7 dias";
      case "month":
        return "30 dias";
    }
  };

  const statCards = stats
    ? [
        {
          title: "Novos Clientes",
          value: stats.totalCustomers.current,
          percentageChange: stats.totalCustomers.percentageChange,
          icon: Users,
          color: "text-blue-600",
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
        },
        {
          title: "Conversas Ativas",
          value: stats.activeConversations.current,
          percentageChange: stats.activeConversations.percentageChange,
          icon: MessageSquare,
          color: "text-green-600",
          bgColor: "bg-green-100 dark:bg-green-900/30",
        },
        {
          title: "Mensagens Recebidas",
          value: stats.messagesReceived.current,
          percentageChange: stats.messagesReceived.percentageChange,
          icon: Activity,
          color: "text-orange-600",
          bgColor: "bg-orange-100 dark:bg-orange-900/30",
        },
        {
          title: "Respostas da IA",
          value: stats.messagesWithAI.current,
          percentageChange: stats.messagesWithAI.percentageChange,
          icon: Bot,
          color: "text-purple-600",
          bgColor: "bg-purple-100 dark:bg-purple-900/30",
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
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
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>
              Últimas interações e atualizações do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Nenhuma atividade recente
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Ações rápidas do sistema</CardDescription>
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
