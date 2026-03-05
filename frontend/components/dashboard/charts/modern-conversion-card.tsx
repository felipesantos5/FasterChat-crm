"use client";

import { Target, Users, Clock, AlertTriangle, Zap } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OverallConversionData } from "@/lib/dashboard";

interface ModernConversionCardProps {
  data: OverallConversionData;
}

export function ModernConversionCard({ data }: ModernConversionCardProps) {
  // Formata segundos para um formato legível (ex: 5min, 2h 15min)
  const formatTime = (seconds: number) => {
    if (seconds === 0) return "Indisponível";
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d+`;
  };

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#c5ecda] dark:bg-[#1a6b38]/30">
            <Target className="h-4 w-4 text-[#1a6b38] dark:text-[#7dd0a0]" />
          </div>
          <CardTitle className="text-sm font-semibold">Saúde e Agilidade do Funil</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3">
        <div className="space-y-3">
          {/* Novos Leads */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">Novos Leads (Período)</p>
                <span className="text-sm font-bold">{data.totalLeads}</span>
              </div>
              <div className="text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                Entradas
              </div>
            </div>
          </div>

          {/* Leads Estagnados */}
          <div className={`flex items-center gap-2 p-2 rounded-lg border ${data.stalledLeads > 0
              ? "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/20"
              : "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/20"
            }`}>
            {data.stalledLeads > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
            <div className="flex-1 flex justify-between items-center">
              <div>
                <p className={`text-xs font-medium ${data.stalledLeads > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300"}`}>
                  Leads Estagnados (+24h)
                </p>
                <span className={`text-sm font-bold ${data.stalledLeads > 0 ? "text-amber-800 dark:text-amber-200" : "text-green-800 dark:text-green-200"}`}>
                  {data.stalledLeads}
                </span>
              </div>
              <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${data.stalledLeads > 0
                  ? "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-800/50"
                  : "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/50"
                }`}>
                {data.stalledRate}%
              </div>
            </div>
          </div>

          {/* Tempo Primeiro Contato */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/20">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 flex justify-between items-center">
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Agilidade p/ 1º Contato</p>
                <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                  {formatTime(data.avgTimeToFirstResponse)}
                </span>
              </div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">
                Velocidade
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
