"use client";

import { useState } from "react";
import Brazil from "@svg-maps/brazil";
import { MapPin, Users } from "lucide-react";
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

const STATE_NAMES: Record<string, string> = {
  ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas",
  ba: "Bahia", ce: "Ceará", df: "Distrito Federal", es: "Espírito Santo",
  go: "Goiás", ma: "Maranhão", mt: "Mato Grosso", ms: "Mato Grosso do Sul",
  mg: "Minas Gerais", pa: "Pará", pb: "Paraíba", pr: "Paraná",
  pe: "Pernambuco", pi: "Piauí", rj: "Rio de Janeiro", rn: "Rio Grande do Norte",
  rs: "Rio Grande do Sul", ro: "Rondônia", rr: "Roraima", sc: "Santa Catarina",
  sp: "São Paulo", se: "Sergipe", to: "Tocantins",
};

export function ModernRegionChart({ data }: ModernRegionChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, visible: false });

  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
        <CardHeader className="items-start pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Clientes por Estado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4 px-4 flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground text-center">
            Nenhum dado de região disponível no período.
          </p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((acc, d) => acc + d.count, 0);
  const maxCount = Math.max(...data.map((d) => d.count));
  const countByState = Object.fromEntries(
    data.map((d) => [d.state.toLowerCase(), d.count])
  );

  const getStateFill = (id: string): string => {
    const count = countByState[id] ?? 0;
    if (count === 0) return "hsl(var(--muted))";
    const intensity = count / maxCount;
    if (intensity > 0.8) return "#3730a3";
    if (intensity > 0.6) return "#4338ca";
    if (intensity > 0.4) return "#4f46e5";
    if (intensity > 0.2) return "#6366f1";
    if (intensity > 0.05) return "#818cf8";
    return "#c7d2fe";
  };

  const top5 = [...data].sort((a, b) => b.count - a.count).slice(0, 5);

  const hoveredData = hoveredId
    ? { name: STATE_NAMES[hoveredId] ?? hoveredId.toUpperCase(), count: countByState[hoveredId] ?? 0 }
    : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true,
    });
  };

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="items-start pb-2 pt-4 px-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <CardTitle className="text-sm font-semibold">Clientes por Estado</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-3 pt-3 pb-2 flex flex-col gap-3">
        {/* Mapa SVG */}
        <div className="relative w-full">
          <svg
            viewBox={Brazil.viewBox}
            className="w-full h-auto"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              setHoveredId(null);
              setTooltip((t) => ({ ...t, visible: false }));
            }}
          >
            {Brazil.locations.map((location) => (
              <path
                key={location.id}
                d={location.path}
                fill={getStateFill(location.id)}
                stroke="white"
                strokeWidth="1"
                className="cursor-pointer transition-opacity duration-150"
                style={{
                  opacity: hoveredId && hoveredId !== location.id ? 0.75 : 1,
                }}
                onMouseEnter={() => setHoveredId(location.id)}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {tooltip.visible && hoveredId && hoveredData && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-3 py-2 shadow-md text-xs"
              style={{
                left: tooltip.x + 12,
                top: tooltip.y - 36,
                transform: tooltip.x > 400 ? "translateX(-110%)" : undefined,
              }}
            >
              <p className="font-semibold text-foreground">{hoveredData.name}</p>
              <p className="text-muted-foreground">
                {hoveredData.count} {hoveredData.count === 1 ? "cliente" : "clientes"}
                {" · "}
                {total > 0 ? ((hoveredData.count / total) * 100).toFixed(1) : 0}%
              </p>
            </div>
          )}
        </div>

        {/* Legenda gradiente */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-muted-foreground">Menos</span>
          <div className="flex-1 mx-2 h-2 rounded-full bg-gradient-to-r from-[#c7d2fe] to-[#3730a3]" />
          <span className="text-[10px] text-muted-foreground">Mais</span>
        </div>

        {/* Top estados */}
        <div className="space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-2">
          {top5.map((item, index) => {
            const pct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.state} className="flex items-center gap-2">
                <span className="w-4 text-[10px] font-bold text-indigo-500 text-right shrink-0">
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-24 shrink-0 truncate">
                  {STATE_NAMES[item.state.toLowerCase()] ?? item.state}
                </span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{item.count}</span>
                  <Users className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
