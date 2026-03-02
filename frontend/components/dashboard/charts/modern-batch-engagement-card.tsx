"use client";

import { MessageSquareShare, Send, Reply } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BatchEngagementData } from "@/lib/dashboard";

interface ModernBatchEngagementCardProps {
  data: BatchEngagementData;
}

export function ModernBatchEngagementCard({ data }: ModernBatchEngagementCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#c5ecda] dark:bg-[#1a6b38]/30">
            <MessageSquareShare className="h-4 w-4 text-[#1a6b38] dark:text-[#7dd0a0]" />
          </div>
          <CardTitle className="text-sm font-semibold">Engajamento em Disparos</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold tracking-tight">{data.responseRate}%</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Taxa de Resposta a Disparos em Lote
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Send className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Enviados c/ Sucesso</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold">{data.attemptedCalls}</span>
                <span className="text-[10px] text-muted-foreground">de {data.totalCalls} disparados</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#f0faf4] dark:bg-[#1a6b38]/20">
            <Reply className="h-4 w-4 text-[#44ba6c]" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium">Respostas Recebidas</p>
              <span className="text-sm font-bold text-[#1a6b38] dark:text-[#7dd0a0]">{data.replies}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
