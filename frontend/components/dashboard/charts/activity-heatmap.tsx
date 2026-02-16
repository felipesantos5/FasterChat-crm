"use client";

import { Clock, Flame } from "lucide-react";

interface HeatmapData {
  day: string;
  hours: number[];
}

interface ActivityHeatmapProps {
  data?: HeatmapData[];
}

// Dados mockados para demonstração
const mockData: HeatmapData[] = [
  { day: "Dom", hours: [2, 3, 1, 0, 0, 1, 3, 5, 8, 12, 15, 18, 20, 22, 25, 20, 15, 12, 10, 8, 5, 4, 3, 2] },
  { day: "Seg", hours: [1, 1, 0, 0, 0, 2, 5, 8, 15, 25, 30, 35, 38, 40, 42, 38, 30, 25, 20, 15, 10, 5, 3, 2] },
  { day: "Ter", hours: [1, 0, 0, 0, 1, 3, 6, 10, 18, 28, 32, 36, 40, 42, 40, 35, 28, 22, 18, 12, 8, 4, 2, 1] },
  { day: "Qua", hours: [0, 0, 0, 1, 2, 4, 7, 12, 20, 30, 35, 38, 42, 45, 42, 38, 30, 25, 20, 15, 10, 5, 2, 1] },
  { day: "Qui", hours: [1, 0, 0, 0, 1, 3, 8, 15, 22, 32, 36, 40, 42, 44, 40, 35, 28, 20, 15, 10, 6, 3, 2, 1] },
  { day: "Sex", hours: [0, 0, 0, 1, 2, 5, 10, 18, 25, 30, 32, 35, 38, 40, 38, 32, 25, 18, 12, 8, 5, 3, 2, 1] },
  { day: "Sáb", hours: [2, 1, 0, 0, 1, 2, 4, 8, 12, 18, 22, 25, 28, 30, 28, 25, 20, 15, 12, 10, 8, 6, 4, 3] },
];

export function ActivityHeatmap({ data = mockData }: ActivityHeatmapProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxValue = Math.max(...data.flatMap((d) => d.hours));

  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return "bg-gray-100 dark:bg-gray-700";
    if (intensity < 0.2) return "bg-blue-200 dark:bg-blue-900/40";
    if (intensity < 0.4) return "bg-blue-300 dark:bg-blue-800/60";
    if (intensity < 0.6) return "bg-blue-400 dark:bg-blue-700/80";
    if (intensity < 0.8) return "bg-blue-500 dark:bg-blue-600";
    return "bg-blue-600 dark:bg-blue-500";
  };

  const peakHour = data
    .flatMap((d, dayIndex) => d.hours.map((value, hour) => ({ dayIndex, hour, value })))
    .reduce((max, curr) => (curr.value > max.value ? curr : max));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Mapa de Atividade
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Picos de horário por dia
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
            {data[peakHour.dayIndex].day} {peakHour.hour}h
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Horas (cabeçalho) */}
          <div className="flex gap-1 mb-2 ml-12">
            {hours.filter((h) => h % 3 === 0).map((hour) => (
              <div
                key={hour}
                className="text-xs text-gray-500 dark:text-gray-400 text-center"
                style={{ width: "calc(12.5% - 4px)" }}
              >
                {hour}h
              </div>
            ))}
          </div>

          {/* Mapa de calor */}
          {data.map((dayData, dayIndex) => (
            <div key={dayIndex} className="flex items-center gap-1 mb-1">
              <div className="w-10 text-xs font-medium text-gray-600 dark:text-gray-400">
                {dayData.day}
              </div>
              {dayData.hours.map((value, hourIndex) => (
                <div
                  key={hourIndex}
                  className={`h-6 flex-1 rounded ${getColor(value)}
                    hover:ring-2 hover:ring-blue-400 hover:ring-offset-1
                    transition-all cursor-pointer group relative`}
                  title={`${dayData.day} ${hourIndex}h: ${value} mensagens`}
                >
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2
                    bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                    {value} msg
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Menos</span>
          <div className="flex gap-1">
            <div className="h-4 w-4 rounded bg-gray-100 dark:bg-gray-700"></div>
            <div className="h-4 w-4 rounded bg-blue-200 dark:bg-blue-900/40"></div>
            <div className="h-4 w-4 rounded bg-blue-300 dark:bg-blue-800/60"></div>
            <div className="h-4 w-4 rounded bg-blue-400 dark:bg-blue-700/80"></div>
            <div className="h-4 w-4 rounded bg-blue-500 dark:bg-blue-600"></div>
            <div className="h-4 w-4 rounded bg-blue-600 dark:bg-blue-500"></div>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Mais</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Pico: <span className="font-semibold text-gray-900 dark:text-white">{maxValue}</span> mensagens
        </div>
      </div>
    </div>
  );
}
