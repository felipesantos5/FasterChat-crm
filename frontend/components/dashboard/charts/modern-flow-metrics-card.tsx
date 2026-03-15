"use client";

import { Zap, CheckCircle2, XCircle, MessageCircle, Play, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowMetricsData } from "@/lib/dashboard";

interface ModernFlowMetricsCardProps {
  data: FlowMetricsData;
}

export function ModernFlowMetricsCard({ data }: ModernFlowMetricsCardProps) {
  const completedPercent = data.totalExecutions > 0 ? Math.round((data.completed / data.totalExecutions) * 100) : 0;
  const failedPercent = data.totalExecutions > 0 ? Math.round((data.failed / data.totalExecutions) * 100) : 0;
  const otherPercent = 100 - completedPercent - failedPercent;

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Fluxos de Automacao</CardTitle>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight">{data.totalExecutions}</span>
            <span className="text-[10px] text-muted-foreground">disparos</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4">
        <div className="space-y-3">
          {/* Barra de progresso segmentada */}
          <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
            {completedPercent > 0 && <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${completedPercent}%` }} />}
            {otherPercent > 0 && <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${otherPercent}%` }} />}
            {failedPercent > 0 && <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${failedPercent}%` }} />}
          </div>

          {/* Taxa de sucesso */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Taxa de sucesso</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{data.successRate}%</span>
          </div>

          {/* Grid de metricas */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/20">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-500">Concluidos</span>
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">{data.completed}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20">
              <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase font-bold text-red-500 dark:text-red-500">Falhas</span>
                <span className="text-sm font-bold text-red-800 dark:text-red-200">{data.failed}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/20">
              <MessageCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-500">Aguardando</span>
                <span className="text-sm font-bold text-amber-800 dark:text-amber-200">{data.waitingReply}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/20">
              <Play className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-500">Em Execucao</span>
                <span className="text-sm font-bold text-blue-800 dark:text-blue-200">{data.running}</span>
              </div>
            </div>
          </div>

          {/* Cancelados (se houver) */}
          {data.cancelled > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <Ban className="h-3.5 w-3.5 text-gray-500 shrink-0" />
              <span className="text-[10px] text-muted-foreground">Cancelados</span>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 ml-auto">{data.cancelled}</span>
            </div>
          )}

          {/* Top Fluxos */}
          {/* {data.topFlows.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Top Fluxos</p>
              <div className="space-y-1.5">
                {data.topFlows.map((flow, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-violet-600 shrink-0">{index + 1}</span>
                      <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate">{flow.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] font-semibold text-gray-900 dark:text-gray-100">{flow.executions}</span>
                      {flow.failed > 0 && (
                        <span className="text-[9px] text-red-500">{flow.failed} falhas</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}
        </div>
      </CardContent>
    </Card>
  );
}
