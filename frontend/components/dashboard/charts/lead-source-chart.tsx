"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { LeadSourceData } from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LeadSourceChartProps {
  data: LeadSourceData[];
}

const GREEN = "#16a34a";

// ── Ícones SVG customizados ──────────────────────────────────────────────────

function IconWhatsappDirect() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {/* Bolha de chat com sinal de wifi — WhatsApp Direto */}
      <path
        d="M10 2C5.58 2 2 5.36 2 9.5c0 1.48.43 2.86 1.18 4.02L2 18l4.6-1.16A8.2 8.2 0 0 0 10 17c4.42 0 8-3.36 8-7.5S14.42 2 10 2Z"
        stroke={GREEN} strokeWidth="1.4" strokeLinejoin="round"
      />
      <path d="M7 9.5a3 3 0 0 1 3-3 3 3 0 0 1 3 3" stroke={GREEN} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M8.5 9.5a1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1.5 1.5" stroke={GREEN} strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="10" cy="9.5" r="0.8" fill={GREEN}/>
    </svg>
  );
}

function IconFlowWebhook() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {/* Fluxo automatizado — nós conectados */}
      <circle cx="3.5" cy="10" r="2" stroke={GREEN} strokeWidth="1.3"/>
      <circle cx="10" cy="3.5" r="2" stroke={GREEN} strokeWidth="1.3"/>
      <circle cx="10" cy="16.5" r="2" stroke={GREEN} strokeWidth="1.3"/>
      <circle cx="16.5" cy="10" r="2" stroke={GREEN} strokeWidth="1.3"/>
      <path d="M5.5 10h2.5M12 10h2.5" stroke={GREEN} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M10 5.5v2.5M10 12v2.5" stroke={GREEN} strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="2.5" stroke={GREEN} strokeWidth="1.3"/>
      <path d="M9 10l.8.8 1.6-1.6" stroke={GREEN} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconFasterchatDirect() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {/* Cursor + chat — FasterChat manual */}
      <path
        d="M3 14.5V17h2.5l7.4-7.4-2.5-2.5L3 14.5Z"
        stroke={GREEN} strokeWidth="1.3" strokeLinejoin="round"
      />
      <path d="M13.1 4.4l2.5 2.5-1.1 1.1-2.5-2.5 1.1-1.1Z" stroke={GREEN} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M14.7 3l2.3 2.3-.8.8-2.3-2.3L14.7 3Z" fill={GREEN}/>
      <path d="M5 17h12v1H5v-1Z" stroke={GREEN} strokeWidth="0.8"/>
    </svg>
  );
}

function IconFlowSpreadsheet() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {/* Planilha com linhas e colunas */}
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke={GREEN} strokeWidth="1.3"/>
      {/* cabeçalho */}
      <path d="M2.5 6.5h15" stroke={GREEN} strokeWidth="1.2"/>
      {/* linhas horizontais */}
      <path d="M2.5 10h15M2.5 13.5h15" stroke={GREEN} strokeWidth="1" strokeDasharray="0"/>
      {/* coluna divisória */}
      <path d="M7.5 6.5v11M12.5 6.5v11" stroke={GREEN} strokeWidth="1"/>
      {/* célula destacada */}
      <rect x="7.5" y="6.5" width="5" height="3.5" fill={GREEN} fillOpacity="0.15"/>
    </svg>
  );
}

function IconWhatsappLink() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {/* Link de WhatsApp — corrente + bolha */}
      <path
        d="M8.5 13.5H6a4 4 0 0 1 0-8h2.5"
        stroke={GREEN} strokeWidth="1.4" strokeLinecap="round"
      />
      <path
        d="M11.5 6.5H14a4 4 0 0 1 0 8h-2.5"
        stroke={GREEN} strokeWidth="1.4" strokeLinecap="round"
      />
      <path d="M7 10h6" stroke={GREEN} strokeWidth="1.4" strokeLinecap="round"/>
      {/* ponto de indicação de WhatsApp */}
      <circle cx="15.5" cy="4.5" r="2.5" fill={GREEN} fillOpacity="0.15" stroke={GREEN} strokeWidth="1"/>
      <path d="M14.6 4.5a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0Z" fill={GREEN}/>
    </svg>
  );
}

const SOURCE_ICON_MAP: Record<string, React.ReactNode> = {
  WHATSAPP_DIRECT: <IconWhatsappDirect />,
  FLOW_WEBHOOK: <IconFlowWebhook />,
  FASTERCHAT_DIRECT: <IconFasterchatDirect />,
  FLOW_SPREADSHEET: <IconFlowSpreadsheet />,
  WHATSAPP_LINK: <IconWhatsappLink />,
};

const SOURCE_COLORS: Record<string, string> = {
  WHATSAPP_DIRECT: "#16a34a",
  FLOW_WEBHOOK: "#16a34a",
  FASTERCHAT_DIRECT: "#16a34a",
  FLOW_SPREADSHEET: "#16a34a",
  WHATSAPP_LINK: "#16a34a",
};

// ── Linha de bolinhas ────────────────────────────────────────────────────────

function DotTimeline({
  timeline,
  color,
  totalDays,
}: {
  timeline: LeadSourceData["timeline"];
  color: string;
  totalDays: number;
}) {
  const [hovered, setHovered] = useState<{ date: string; count: number } | null>(null);

  const allDots = Array.from({ length: Math.min(totalDays, 30) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (Math.min(totalDays, 30) - 1 - i));
    const key = d.toISOString().split("T")[0];
    const item = timeline.find((t) => t.date === key);
    return { date: key, count: item?.count ?? 0 };
  });

  const maxCount = Math.max(...allDots.map((d) => d.count), 1);

  return (
    <div className="relative flex items-center gap-[3px]">
      {allDots.map((dot) => {
        const intensity = dot.count / maxCount;
        const size = dot.count === 0 ? 6 : Math.round(6 + intensity * 8);
        return (
          <div
            key={dot.date}
            className="relative flex items-center justify-center cursor-default"
            style={{ width: 14, height: 14 }}
            onMouseEnter={() => dot.count > 0 && setHovered(dot)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: dot.count === 0 ? "#e5e7eb" : color,
                opacity: dot.count === 0 ? 1 : 0.3 + intensity * 0.7,
              }}
            />
            {hovered?.date === dot.date && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 whitespace-nowrap rounded border bg-popover px-2 py-1 text-[10px] shadow-md pointer-events-none">
                {dot.count} {dot.count === 1 ? "lead" : "leads"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function LeadSourceChart({ data }: LeadSourceChartProps) {
  const [period, setPeriod] = useState<"1" | "7" | "30">("30");
  const totalDays = parseInt(period);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - totalDays);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const filtered = data
    .map((src) => ({
      ...src,
      timeline: src.timeline.filter((t) => t.date >= cutoffStr),
      total: src.timeline
        .filter((t) => t.date >= cutoffStr)
        .reduce((acc, t) => acc + t.count, 0),
    }))
    .filter((src) => src.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="items-start pb-2 pt-4 px-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-semibold">Origem dos Contatos</CardTitle>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(["1", "7", "30"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                  period === p
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "1" ? "Hoje" : p === "7" ? "7d" : "30d"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-4 pt-3 pb-3">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Nenhum contato registrado neste período.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((src) => {
              const color = SOURCE_COLORS[src.source] ?? GREEN;
              const icon = SOURCE_ICON_MAP[src.source] ?? <IconFasterchatDirect />;
              return (
                <div key={src.source} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {src.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold" style={{ color }}>
                      {src.total}
                    </span>
                  </div>
                  <DotTimeline
                    timeline={src.timeline}
                    color={color}
                    totalDays={totalDays}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
