"use client";

import { Target, Users, CheckCircle2 } from "lucide-react";
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
  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#c5ecda] dark:bg-[#1a6b38]/30">
            <Target className="h-4 w-4 text-[#1a6b38] dark:text-[#7dd0a0]" />
          </div>
          <CardTitle className="text-sm font-semibold">Taxa de Conversão Geral</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold tracking-tight">{data.conversionRate}%</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Baseado nos leads criados no período
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Novos Leads</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold">{data.totalLeads}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Fechamentos (Última Etapa)</p>
              <span className="text-sm font-bold">{data.convertedLeads}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
