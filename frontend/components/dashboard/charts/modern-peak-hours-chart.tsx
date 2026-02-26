"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Clock, TrendingUp } from "lucide-react";
import { HourlyMessageData } from "@/lib/dashboard";

interface ModernPeakHoursChartProps {
  data: HourlyMessageData[];
}

export function ModernPeakHoursChart({ data }: ModernPeakHoursChartProps) {
  // Agrupa os dados de 2 em 2 horas
  const groupedData = data.reduce((acc, curr) => {
    const hourInt = parseInt(curr.hour.split(':')[0], 10);
    // Cria blocos de 2 horas: 0-1 -> 00H, 2-3 -> 02H, etc.
    const groupHour = Math.floor(hourInt / 2) * 2;
    // Formata o label para mostrar o intervalo, ex: "00:00 - 02:00" ou apenas a hora de início
    const groupKey = `${groupHour.toString().padStart(2, '0')}:00`;

    const existingGroup = acc.find(item => item.hour === groupKey);
    if (existingGroup) {
      existingGroup.count += curr.count;
    } else {
      acc.push({ hour: groupKey, count: curr.count });
    }
    return acc;
  }, [] as HourlyMessageData[]);

  // Encontra o horário de pico para destaque com base nos dados agrupados
  const peakHour = [...groupedData].sort((a, b) => b.count - a.count)[0];
  // const totalMessages = groupedData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-md">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-none">
              Pico de Mensagens
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 pl-[30px]">
            Volume a cada 2 horas
          </p>
        </div>
        {peakHour && peakHour.count > 0 && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 justify-end leading-none">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">{peakHour.hour}</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-semibold">
              Pico
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 w-full min-h-[160px] max-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={groupedData}
            margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.4} />
            <XAxis
              dataKey="hour"
              stroke="#9CA3AF"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={0} // Mostra todos os labels já que reduzimos para 12 barras
              tickFormatter={(val) => val.replace(':00', 'h')}
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }}
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                padding: "8px 12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                fontSize: "12px",
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}
              formatter={(value) => [`${value} mensagens`, 'Volume']}
              labelFormatter={(label) => {
                const hourInt = parseInt(label.replace('h', ''));
                return `${label} - ${(hourInt + 2).toString().padStart(2, '0')}:00`;
              }}
            />
            <Bar
              dataKey="count"
              radius={[3, 3, 0, 0]}
              name="Mensagens"
              maxBarSize={40}
            >
              {groupedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.hour === peakHour?.hour ? "#10B981" : "#A7F3D0"}
                  fillOpacity={1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total no período</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{totalMessages} msg</span>
        </div>
      </div> */}
    </div>
  );
}
