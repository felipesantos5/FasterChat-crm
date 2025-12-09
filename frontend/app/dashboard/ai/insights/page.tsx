"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ThumbsUp, ThumbsDown, TrendingUp, MessageSquare, BarChart3 } from "lucide-react";
import { messageApi } from "@/lib/message";
import { Message } from "@/types/message";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AIInsightsPage() {
  const [stats, setStats] = useState<{
    totalAiMessages: number;
    goodFeedback: number;
    badFeedback: number;
    noFeedback: number;
    goodPercentage: number;
  } | null>(null);
  const [badMessages, setBadMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBadMessages, setLoadingBadMessages] = useState(true);

  // Obtém companyId do usuário logado
  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Carrega estatísticas
  const loadStats = async () => {
    try {
      const companyId = getCompanyId();
      if (!companyId) {
        console.error("Company ID not found");
        return;
      }

      const response = await messageApi.getFeedbackStats(companyId);
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carrega mensagens com feedback negativo
  const loadBadMessages = async () => {
    try {
      const companyId = getCompanyId();
      if (!companyId) {
        console.error("Company ID not found");
        return;
      }

      const response = await messageApi.getMessagesWithBadFeedback(companyId, 50, 0);
      setBadMessages(response.data.messages);
    } catch (error) {
      console.error("Error loading bad messages:", error);
    } finally {
      setLoadingBadMessages(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadBadMessages();
  }, []);

  // Formata timestamp
  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cards de Estatísticas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total de Mensagens */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens da IA</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAiMessages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Mensagens enviadas automaticamente</p>
          </CardContent>
        </Card>

        {/* Feedback Positivo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Positivo</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.goodFeedback || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats?.goodPercentage.toFixed(1)}% das avaliações</p>
          </CardContent>
        </Card>

        {/* Feedback Negativo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Negativo</CardTitle>
            <ThumbsDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.badFeedback || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Requer atenção e revisão</p>
          </CardContent>
        </Card>

        {/* Sem Feedback */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Feedback</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.noFeedback || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando avaliação</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taxa de Aprovação
          </CardTitle>
          <CardDescription>Percentual de respostas com feedback positivo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Barra de Progresso */}
            <div className="relative h-8 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                style={{ width: `${stats?.goodPercentage || 0}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-semibold text-white drop-shadow-md">{stats?.goodPercentage.toFixed(1)}%</span>
              </div>
            </div>

            {/* Legenda */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Positivo ({stats?.goodFeedback})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Negativo ({stats?.badFeedback})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
                <span className="text-muted-foreground">Sem feedback ({stats?.noFeedback})</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensagens com Feedback Negativo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-red-600" />
            Mensagens para Revisão
          </CardTitle>
          <CardDescription>
            Respostas da IA que receberam feedback negativo. Use essas informações para ajustar e melhorar o treinamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBadMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : badMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ThumbsUp className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Nenhuma mensagem com feedback negativo</p>
              <p className="text-sm mt-1">Todas as respostas da IA estão sendo bem avaliadas!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {badMessages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{message.customer?.name || "Cliente"}</Badge>
                        <span className="text-xs text-muted-foreground">{formatMessageTime(message.timestamp)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      {message.feedbackNote && (
                        <div className="bg-muted/50 rounded p-3 mt-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Nota do Feedback:</p>
                          <p className="text-sm text-muted-foreground italic">{message.feedbackNote}</p>
                        </div>
                      )}
                    </div>
                    <ThumbsDown className="h-5 w-5 text-red-600 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sugestões Automáticas */}
      <Card>
        <CardHeader>
          <CardTitle>Sugestões de Melhoria</CardTitle>
          <CardDescription>Recomendações baseadas nos padrões de feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats && stats.badFeedback > 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                <div className="h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Revisar respostas com feedback negativo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Existem {stats.badFeedback} mensagens que receberam feedback negativo. Revise essas respostas para identificar padrões e ajustar a
                    base de conhecimento da IA.
                  </p>
                </div>
              </div>
            )}

            {stats && stats.goodPercentage >= 80 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ThumbsUp className="h-3 w-3 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Ótimo desempenho!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A IA está com {stats.goodPercentage.toFixed(1)}% de aprovação. Continue monitorando e marcando conversas exemplares para manter
                    esse padrão.
                  </p>
                </div>
              </div>
            )}

            {stats && stats.goodPercentage < 50 && stats.badFeedback + stats.goodFeedback > 5 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ThumbsDown className="h-3 w-3 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Taxa de aprovação baixa</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A IA está com apenas {stats.goodPercentage.toFixed(1)}% de aprovação. Considere revisar as configurações da IA, adicionar mais
                    exemplos de conversas e ajustar a base de conhecimento.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Colete mais feedback</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Incentive sua equipe a avaliar as respostas da IA usando os botões de feedback. Quanto mais dados coletados, melhor será o
                  fine-tuning futuro.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
