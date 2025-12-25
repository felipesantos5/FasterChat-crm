"use client";

import { useAuthStore } from "@/lib/store/auth.store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Settings,
  LogOut,
  LayoutDashboard,
  Users,
  MessageSquare,
  Bot,
  Smartphone,
  BookOpen,
  BarChart3,
  Megaphone,
  Kanban,
  CalendarDays,
  Link2,
  LucideIcon,
  Menu,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useMemo } from "react";
import { useSidebar } from "@/contexts/SidebarContext";

interface PageInfo {
  label: string;
  icon: LucideIcon;
  description: string;
}

const pageMap: Record<string, PageInfo> = {
  "/dashboard": {
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Visão geral do sistema",
  },
  "/dashboard/calendario": {
    label: "Calendário",
    icon: CalendarDays,
    description: "Agendamentos e compromissos",
  },
  "/dashboard/customers": {
    label: "Clientes",
    icon: Users,
    description: "Gerenciamento de clientes",
  },
  "/dashboard/pipeline": {
    label: "Funil",
    icon: Kanban,
    description: "Funil de vendas",
  },
  "/dashboard/conversations": {
    label: "Conversas",
    icon: MessageSquare,
    description: "Mensagens e atendimentos",
  },
  "/dashboard/campaigns": {
    label: "Campanhas",
    icon: Megaphone,
    description: "Campanhas de marketing",
  },
  "/dashboard/links": {
    label: "Links de WhatsApp",
    icon: Link2,
    description: "Links de conversão",
  },
  "/dashboard/settings/ai": {
    label: "Configurações de IA",
    icon: Bot,
    description: "Ajustes do assistente",
  },
  "/dashboard/settings/whatsapp": {
    label: "WhatsApp",
    icon: Smartphone,
    description: "Conexões do WhatsApp",
  },
  "/dashboard/ai/insights": {
    label: "Insights de IA",
    icon: BarChart3,
    description: "Análises inteligentes",
  },
  "/dashboard/ai/examples": {
    label: "Exemplos de Conversas",
    icon: BookOpen,
    description: "Treinamento da IA",
  },
  "/dashboard/perfil": {
    label: "Perfil",
    icon: User,
    description: "Suas informações",
  },
  "/dashboard/configuracoes": {
    label: "Configurações",
    icon: Settings,
    description: "Configurações gerais",
  },
};

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { toggle } = useSidebar();

  // Encontra a página atual baseado na rota
  const currentPage = useMemo((): PageInfo => {
    // Primeiro tenta match exato
    if (pageMap[pathname]) {
      return pageMap[pathname];
    }

    // Depois tenta match parcial para rotas dinâmicas
    const matchingPath = Object.keys(pageMap)
      .filter((path) => pathname.startsWith(path) && path !== "/dashboard")
      .sort((a, b) => b.length - a.length)[0];

    if (matchingPath) {
      return pageMap[matchingPath];
    }

    // Fallback para dashboard
    return pageMap["/dashboard"];
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const PageIcon = currentPage.icon;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background px-2 md:px-4 lg:px-6">
      <div className="flex flex-1 items-center justify-between gap-2 md:gap-4">
        {/* Mobile Menu Button + Current Page Info */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Botão Hamburger - apenas mobile */}
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 flex-shrink-0">
            <PageIcon className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 truncate">{currentPage.label}</h1>
            <p className="text-xs text-gray-500 hidden sm:block">{currentPage.description}</p>
          </div>
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 gap-2 rounded-full pl-1 pr-1 sm:pl-2 sm:pr-2 flex-shrink-0">
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start text-xs sm:text-sm">
                <span className="font-medium truncate max-w-[120px]">{user?.name || "Usuário"}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/perfil")}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/dashboard/configuracoes")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
