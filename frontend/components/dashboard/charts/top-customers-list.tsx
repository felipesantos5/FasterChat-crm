"use client";

import { Trophy, MessageCircle, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TopCustomer {
  id: string;
  name: string;
  messageCount: number;
  lastMessage: string;
  avatarUrl?: string;
  trend: "up" | "down" | "same";
}

interface TopCustomersListProps {
  data?: TopCustomer[];
}

// Mock data para demonstração
const mockData: TopCustomer[] = [
  {
    id: "1",
    name: "João Silva",
    messageCount: 156,
    lastMessage: "2h atrás",
    trend: "up",
  },
  {
    id: "2",
    name: "Maria Santos",
    messageCount: 142,
    lastMessage: "5h atrás",
    trend: "up",
  },
  {
    id: "3",
    name: "Carlos Oliveira",
    messageCount: 128,
    lastMessage: "1d atrás",
    trend: "same",
  },
  {
    id: "4",
    name: "Ana Costa",
    messageCount: 95,
    lastMessage: "3h atrás",
    trend: "down",
  },
  {
    id: "5",
    name: "Pedro Alves",
    messageCount: 87,
    lastMessage: "6h atrás",
    trend: "up",
  },
];

const getTrophyColor = (index: number) => {
  switch (index) {
    case 0:
      return "text-yellow-500";
    case 1:
      return "text-gray-400";
    case 2:
      return "text-orange-600";
    default:
      return "text-gray-300";
  }
};

export function TopCustomersList({ data = mockData }: TopCustomersListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Clientes
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Mais ativos no período
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((customer, index) => {
          const initials = customer.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();

          return (
            <div
              key={customer.id}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50
                transition-all duration-200 cursor-pointer group"
            >
              {/* Ranking */}
              <div className="flex items-center justify-center w-8">
                {index < 3 ? (
                  <Trophy className={`h-5 w-5 ${getTrophyColor(index)}`} />
                ) : (
                  <span className="text-sm font-semibold text-gray-400">
                    #{index + 1}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-gray-800">
                <AvatarImage src={customer.avatarUrl} alt={customer.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {customer.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {customer.lastMessage}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <MessageCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    {customer.messageCount}
                  </span>
                </div>

                {/* Trend indicator */}
                {customer.trend === "up" && (
                  <div className="p-1 bg-green-100 dark:bg-green-900/20 rounded">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                )}
                {customer.trend === "down" && (
                  <div className="p-1 bg-red-100 dark:bg-red-900/20 rounded">
                    <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400 rotate-180" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ver todos */}
      <button className="mt-4 w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400
        hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
        Ver todos os clientes
      </button>
    </div>
  );
}
