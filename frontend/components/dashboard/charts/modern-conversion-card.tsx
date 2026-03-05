"use client";

import { HeartPulse, Activity, UserMinus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomerActivityData } from "@/lib/dashboard";

interface ModernConversionCardProps {
  data: CustomerActivityData;
}

export function ModernConversionCard({ data }: ModernConversionCardProps) {
  const activePercent = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;
  const inactivePercent = data.total > 0 ? Math.round((data.inactive / data.total) * 100) : 0;

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30">
            <HeartPulse className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <CardTitle className="text-sm font-semibold">Engajamento de Clientes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4">
        <div className="space-y-4">

          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-500">Total na base</div>
            <div className="font-bold text-gray-900 dark:text-gray-100">{data.total} clientes</div>
          </div>

          <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 rounded-l-full transition-all duration-500"
              style={{ width: `${activePercent}%` }}
              title={`${activePercent}% Ativos`}
            />
            <div
              className="h-full bg-red-400 rounded-r-full transition-all duration-500"
              style={{ width: `${inactivePercent}%` }}
              title={`${inactivePercent}% Inativos`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/20">
              <div className="p-1.5 bg-green-100 dark:bg-green-800/50 rounded-md">
                <Activity className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-500">Ativos</span>
                <span className="text-sm font-bold text-green-800 dark:text-green-200">{data.active}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20">
              <div className="p-1.5 bg-red-100 dark:bg-red-800/50 rounded-md">
                <UserMinus className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-500">Inativos</span>
                <span className="text-sm font-bold text-red-800 dark:text-red-200">{data.inactive}</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 text-center mt-1">
            *Inativos não interagem há +30 dias
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
