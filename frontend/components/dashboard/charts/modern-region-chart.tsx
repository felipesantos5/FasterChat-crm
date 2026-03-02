"use client";

import { Users, MapPin } from "lucide-react";
import { ClientsByStateData } from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ModernRegionChartProps {
  data: ClientsByStateData[];
}

export function ModernRegionChart({ data }: ModernRegionChartProps) {
  // Sort descending and take top 6
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const top6 = sortedData.slice(0, 6);

  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
        <CardHeader className="items-start pb-2 pt-4 px-4">
          <div className="flex w-full justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle className="text-sm font-semibold">Clientes por Região</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4 px-4 flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground text-center">Nenhum dado de região disponível no período.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="items-start pb-2 pt-4 px-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex w-full justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Clientes por Região</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="flex flex-col h-full py-2">
          {top6.map((item, index) => (
            <div key={item.state} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {index + 1}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.state}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.count}</span>
                <Users className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
