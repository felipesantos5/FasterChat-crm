"use client";

import { Users, MessageSquare, ArrowDownLeft, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollaboratorPerformanceData } from "@/lib/dashboard";

interface ModernTeamPerformanceCardProps {
  data: CollaboratorPerformanceData[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-green-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-indigo-500",
];

export function ModernTeamPerformanceCard({ data }: ModernTeamPerformanceCardProps) {
  const totalSent = data.reduce((s, c) => s + c.messagesSent, 0);

  return (
    <Card className="w-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Desempenho da Equipe</CardTitle>
          </div>
          <span className="text-xs text-gray-400">{data.length} profissionais</span>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4">
        {/* Header da tabela */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center px-3 mb-2">
          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide">Profissional</span>
          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide text-center w-20">Conversas</span>
          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide text-center w-20">Msgs Enviadas</span>
          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide text-center w-20">Msgs Recebidas</span>
          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide text-center w-20">Clientes Ativos</span>
        </div>

        <div className="space-y-2">
          {data.map((collaborator, index) => {
            const share = totalSent > 0 ? (collaborator.messagesSent / totalSent) * 100 : 0;
            const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

            return (
              <div
                key={collaborator.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {/* Profissional */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-[11px] font-bold text-white">{getInitials(collaborator.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{collaborator.name}</p>
                    {collaborator.cargo && (
                      <p className="text-[11px] text-gray-500 truncate">{collaborator.cargo}</p>
                    )}
                    {/* Barra de share */}
                    {share > 0 && (
                      <div className="mt-1 h-1 w-full max-w-[120px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-500"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Conversas */}
                <div className="flex flex-col items-center w-20">
                  <div className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-blue-400" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {collaborator.conversationsAssigned}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">atribuídas</span>
                </div>

                {/* Msgs enviadas */}
                <div className="flex flex-col items-center w-20">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-green-500" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {collaborator.messagesSent}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">enviadas</span>
                </div>

                {/* Msgs recebidas */}
                <div className="flex flex-col items-center w-20">
                  <div className="flex items-center gap-1">
                    <ArrowDownLeft className="h-3 w-3 text-orange-400" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {collaborator.messagesReceived}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">recebidas</span>
                </div>

                {/* Clientes ativos */}
                <div className="flex flex-col items-center w-20">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-violet-400" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {collaborator.uniqueCustomers}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">no período</span>
                </div>
              </div>
            );
          })}
        </div>

        {data.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            Nenhuma conversa atribuída no período
          </div>
        )}
      </CardContent>
    </Card>
  );
}
