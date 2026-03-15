"use client";

import { useState } from "react";
import Brazil from "@svg-maps/brazil";
import { MapPin } from "lucide-react";
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

// Sigla → nome completo (para exibição)
const STATE_NAMES: Record<string, string> = {
  ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas",
  ba: "Bahia", ce: "Ceará", df: "Distrito Federal", es: "Espírito Santo",
  go: "Goiás", ma: "Maranhão", mt: "Mato Grosso", ms: "Mato Grosso do Sul",
  mg: "Minas Gerais", pa: "Pará", pb: "Paraíba", pr: "Paraná",
  pe: "Pernambuco", pi: "Piauí", rj: "Rio de Janeiro", rn: "Rio Grande do Norte",
  rs: "Rio Grande do Sul", ro: "Rondônia", rr: "Roraima", sc: "Santa Catarina",
  sp: "São Paulo", se: "Sergipe", to: "Tocantins",
};

// Nome completo (lowercase) → sigla (para mapear dados do backend → IDs do SVG)
const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code])
);

const GREEN_SCALE = ["#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#14532d"];
const EMPTY_FILL = "#e5e7eb"; // hex direto — CSS vars não funcionam em fill de SVG

function getStateColor(count: number, maxCount: number): string {
  if (count === 0) return EMPTY_FILL;
  const intensity = count / maxCount;
  if (intensity > 0.83) return GREEN_SCALE[5];
  if (intensity > 0.66) return GREEN_SCALE[4];
  if (intensity > 0.49) return GREEN_SCALE[3];
  if (intensity > 0.32) return GREEN_SCALE[2];
  if (intensity > 0.15) return GREEN_SCALE[1];
  return GREEN_SCALE[0];
}

export function ModernRegionChart({ data }: ModernRegionChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, visible: false });

  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col shadow-lg border-gray-100 dark:border-gray-800 h-full">
        <CardHeader className="items-start py-1.5 sm:py-2 px-2 sm:px-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
            <CardTitle className="text-xs sm:text-sm font-semibold">Clientes por Estado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pb-3">
          <p className="text-xs text-muted-foreground text-center">
            Nenhum dado de região disponível.
          </p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((acc, d) => acc + d.count, 0);
  const maxCount = Math.max(...data.map((d) => d.count));

  // Normaliza state do backend (pode ser nome completo "Bahia" ou sigla "BA") → sigla SVG "ba"
  const countByState: Record<string, number> = {};
  for (const d of data) {
    const lower = d.state.toLowerCase();
    // Se já é uma sigla de 2 letras conhecida, usa direto
    const code = lower.length === 2 && STATE_NAMES[lower]
      ? lower
      : NAME_TO_CODE[lower] ?? lower;
    countByState[code] = (countByState[code] ?? 0) + d.count;
  }

  const getStateFill = (id: string): string => {
    const count = countByState[id] ?? 0;
    return getStateColor(count, maxCount);
  };

  const top3 = [...data].sort((a, b) => b.count - a.count).slice(0, 3);

  const hoveredData = hoveredId
    ? {
        name: STATE_NAMES[hoveredId] ?? hoveredId.toUpperCase(),
        count: countByState[hoveredId] ?? 0,
      }
    : null;

  // Resolve nome de exibição: backend envia nome completo, usamos direto; se for sigla, converte
  const getDisplayName = (state: string): string => {
    const lower = state.toLowerCase();
    if (lower.length === 2 && STATE_NAMES[lower]) return STATE_NAMES[lower];
    return state; // Já é nome completo
  };

  // Resolve código SVG a partir do state do backend
  const getStateCode = (state: string): string => {
    const lower = state.toLowerCase();
    if (lower.length === 2 && STATE_NAMES[lower]) return lower;
    return NAME_TO_CODE[lower] ?? lower;
  };

  return (
    <Card className="flex flex-col shadow-lg border-gray-100 dark:border-gray-800 overflow-hidden h-full">
      {/* Header */}
      <CardHeader className="items-start py-1.5 sm:py-2 px-2 sm:px-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
          <CardTitle className="text-xs sm:text-sm font-semibold">Clientes por Estado</CardTitle>
        </div>
      </CardHeader>

      {/* Body: mapa com lista sobreposta no canto inferior esquerdo */}
      <CardContent className="flex-1 p-0 relative overflow-hidden">
        {/* Mapa ocupa todo o espaço */}
        <div
          className="w-full h-full flex items-center justify-center"
          onMouseLeave={() => {
            setHoveredId(null);
            setTooltip((t) => ({ ...t, visible: false }));
          }}
        >
          <svg
            viewBox={Brazil.viewBox}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });
            }}
          >
            {Brazil.locations.map((location) => (
              <path
                key={location.id}
                d={location.path}
                fill={getStateFill(location.id)}
                stroke="#ffffff"
                strokeWidth="1.2"
                style={{
                  opacity: hoveredId && hoveredId !== location.id ? 0.65 : 1,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={() => setHoveredId(location.id)}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {tooltip.visible && hoveredId && hoveredData && hoveredData.count > 0 && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-2.5 py-1.5 shadow-md text-[11px]"
              style={{
                left: tooltip.x + 8,
                top: tooltip.y - 32,
                transform: tooltip.x > 160 ? "translateX(-110%)" : undefined,
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

        {/* Lista top 3 — posicionada no canto inferior esquerdo sobre o mapa */}
        <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow-sm border border-gray-100 dark:border-gray-700 max-w-[45%]">
          {top3.map((item, index) => {
            const code = getStateCode(item.state);
            const color = getStateColor(countByState[code] ?? item.count, maxCount);
            const name = getDisplayName(item.state);
            return (
              <div key={item.state} className="flex items-center justify-between gap-1 mb-1 last:mb-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[9px] font-bold text-green-600 shrink-0">{index + 1}</span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">
                    {name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-gray-900 dark:text-gray-100 shrink-0 ml-2">
                  {item.count}
                </span>
              </div>
            );
          })}

          {/* Total */}
          <div className="pt-1 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">Total</span>
            <span className="text-[10px] font-bold text-green-600">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
