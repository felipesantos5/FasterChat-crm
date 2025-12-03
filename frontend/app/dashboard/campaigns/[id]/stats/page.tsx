'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { campaignApi } from '@/lib/campaign';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  successRate: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
}

interface CampaignLog {
  id: string;
  customerName: string;
  customerPhone: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  message: string;
  error?: string;
  sentAt?: string;
  createdAt: string;
}

export default function CampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadStats = async () => {
    try {
      const statsData = await campaignApi.getStats(campaignId);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadLogs = async (pageNum = 1) => {
    try {
      const logsData = await campaignApi.getLogs(campaignId, pageNum, 20);
      setLogs(logsData.logs);
      setPage(logsData.page);
      setTotalPages(logsData.totalPages);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadLogs(page)]);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();

    // Auto-refresh a cada 5 segundos se a campanha estiver processando
    const interval = setInterval(() => {
      if (stats?.status === 'PROCESSING') {
        loadStats();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [campaignId, page]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Enviada
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => router.back()} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Estatísticas da Campanha</h1>
            <p className="text-muted-foreground">Monitoramento em tempo real</p>
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total de Destinatários</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
          </Card>

          <Card className="p-6 bg-green-50 border-green-200">
            <div className="space-y-2">
              <p className="text-sm text-green-700">Enviadas com Sucesso</p>
              <p className="text-3xl font-bold text-green-600">{stats.sent}</p>
              <p className="text-xs text-green-600">Taxa: {stats.successRate}</p>
            </div>
          </Card>

          <Card className="p-6 bg-red-50 border-red-200">
            <div className="space-y-2">
              <p className="text-sm text-red-700">Falharam</p>
              <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
            </div>
          </Card>

          <Card className="p-6 bg-yellow-50 border-yellow-200">
            <div className="space-y-2">
              <p className="text-sm text-yellow-700">Pendentes</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Progress Info */}
      {stats && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Progresso</h3>
              <Badge variant={stats.status === 'PROCESSING' ? 'default' : 'secondary'}>
                {stats.status}
              </Badge>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processadas: {stats.sent + stats.failed} de {stats.total}</span>
                <span>{Math.round(((stats.sent + stats.failed) / stats.total) * 100)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((stats.sent + stats.failed) / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {stats.startedAt && (
                <div>
                  <span className="text-muted-foreground">Iniciada: </span>
                  <span>{formatDistanceToNow(new Date(stats.startedAt), { addSuffix: true, locale: ptBR })}</span>
                </div>
              )}
              {stats.completedAt && (
                <div>
                  <span className="text-muted-foreground">Concluída: </span>
                  <span>{formatDistanceToNow(new Date(stats.completedAt), { addSuffix: true, locale: ptBR })}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Logs Table */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Logs de Envio</h3>

          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{log.customerName}</p>
                          <span className="text-sm text-muted-foreground">{log.customerPhone}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {log.message.substring(0, 100)}
                          {log.message.length > 100 ? '...' : ''}
                        </p>
                        {log.error && (
                          <p className="text-sm text-red-600 mt-1">
                            ❌ Erro: {log.error}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(log.status)}
                        <span className="text-xs text-muted-foreground">
                          {log.sentAt
                            ? formatDistanceToNow(new Date(log.sentAt), { addSuffix: true, locale: ptBR })
                            : formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => loadLogs(page - 1)}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  Anterior
                </Button>
                <Button
                  onClick={() => loadLogs(page + 1)}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
