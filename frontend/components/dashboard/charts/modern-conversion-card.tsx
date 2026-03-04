"use client";

import { Target, Users, CheckCircle2, XCircle } from "lucide-react";
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
        {/* <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold tracking-tight">{data.conversionRate}%</span>
        </div> */}

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

          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <div className="flex-1 flex justify-between items-center">
              <div>
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">Fechamentos / Vendas</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-green-800 dark:text-green-200">{data.convertedLeads}</span>
                </div>
              </div>
              <div className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/50 px-2 py-0.5 rounded-full">
                {data.conversionRate}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <div className="flex-1 flex justify-between items-center">
              <div>
                <p className="text-xs text-red-700 dark:text-red-300 font-medium">Clientes Perdidos</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-red-800 dark:text-red-200">{data.lostLeads || 0}</span>
                </div>
              </div>
              <div className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-800/50 px-2 py-0.5 rounded-full">
                {data.lostRate || 0}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
