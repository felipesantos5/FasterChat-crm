"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  Bot,
  ChevronDown,
  Megaphone,
  CalendarDays,
  Link2,
  FunnelPlus,
  X,
  Network,
  Lock,
  Smartphone,
  Zap,
  MessageSquareText,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { AnimatedNavIcon, type NavIconAnimation } from "@/components/layout/AnimatedNavIcon";
import logo from "@/assets/logo2.webp";
import { useSidebar } from "@/contexts/SidebarContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/lib/store/auth.store";
import { useHandoffsCount } from "@/hooks/use-handoffs-count";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { usePlanFeatures, PlanFeature, PLAN_NAMES, FEATURE_MIN_PLAN, isPageAllowedForFree } from "@/hooks/usePlanFeatures";
import { PricingModal } from "@/components/dashboard/pricing-modal";

// Tipo para os itens de menu
interface MenuItem {
  label: string;
  icon: any;
  animation?: NavIconAnimation;
  href?: string;
  children?: MenuItem[];
  permission?: string; // Permissão necessária para ver este item
  adminOnly?: boolean; // Item visível apenas para ADMIN
  planFeature?: PlanFeature; // Feature de plano necessária para este item
}

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    animation: "spring-pop",
    href: "/dashboard",
    permission: "DASHBOARD",
  },
  {
    label: "Clientes",
    icon: Users,
    animation: "bounce-up",
    href: "/dashboard/customers",
    permission: "CUSTOMERS",
  },
  {
    label: "Conversas",
    icon: MessageSquare,
    animation: "spring-pop",
    href: "/dashboard/conversations",
    permission: "CONVERSATIONS",
  },
  {
    label: "Funil",
    icon: FunnelPlus,
    animation: "drop-in",
    href: "/dashboard/pipeline",
    permission: "PIPELINE",
  },
  {
    label: "Calendário",
    icon: CalendarDays,
    animation: "flip-x",
    href: "/dashboard/calendario",
    permission: "CALENDAR",
    planFeature: "GOOGLE_CALENDAR",
  },
  {
    label: "Campanhas",
    icon: Megaphone,
    animation: "wiggle",
    href: "/dashboard/campaigns",
    permission: "CAMPAIGNS",
    planFeature: "CAMPAIGNS",
  },
  {
    label: "Links de WhatsApp",
    icon: Link2,
    animation: "snap",
    href: "/dashboard/links",
    permission: "WHATSAPP_LINKS",
    planFeature: "WHATSAPP_LINKS",
  },
  {
    label: "Fluxos de Automação",
    icon: Network,
    animation: "pulse-out",
    href: "/dashboard/flows",
    planFeature: "WORKFLOW",
  },
  {
    label: "Configurações",
    icon: Settings,
    animation: "spin",
    children: [
      {
        label: "Agente",
        icon: Bot,
        animation: "heartbeat",
        href: "/dashboard/settings/ai",
      },
      {
        label: "WhatsApp",
        icon: Smartphone,
        animation: "spring-pop",
        href: "/dashboard/settings/whatsapp",
      },
      {
        label: "Script de atendimento",
        icon: Zap,
        animation: "zap",
        href: "/dashboard/settings/ai/scripts",
      },
      {
        label: "Mensagens Rápidas",
        icon: MessageSquareText,
        animation: "spring-pop",
        href: "/dashboard/configuracoes/mensagens-rapidas",
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const { isOpen, close } = useSidebar();
  const { user, isLoading: authLoading } = useAuthStore();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { hasFeature, currentPlan } = usePlanFeatures();
  const { count: handoffsCount, isError } = useHandoffsCount();
  const { count: unreadCount } = useUnreadCount(user?.companyId);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const loading = authLoading || permissionsLoading;

  useEffect(() => {
    if (isError) {
      console.error("[Sidebar] Error loading handoffs count:", isError);
    }
  }, [isError]);

  // Lista de todos os hrefs no menu para resolver conflitos de prefixo
  const allHrefs = useMemo(() => {
    const hrefs: string[] = [];
    const collect = (items: MenuItem[]) => {
      items.forEach((item) => {
        if (item.href) hrefs.push(item.href);
        if (item.children) collect(item.children);
      });
    };
    collect(menuItems);
    return hrefs;
  }, []);

  const checkActive = (href: string | undefined): boolean => {
    if (!href) return false;
    if (pathname === href) return true;
    if (href === "/dashboard") return pathname === "/dashboard";

    // Verifica se é um match de prefixo (ex: /clientes/123 -> /clientes)
    // MAS apenas se não existir outro item no menu com um match mais longo/específico
    const isPrefixMatch = pathname.startsWith(href + "/");
    if (!isPrefixMatch) return false;

    // Se existe outro href no menu que também é prefixo deste pathname e é mais longo que o atual,
    // então este atual (mais curto) não deve ser o "active".
    const hasMoreSpecificMatch = allHrefs.some((h) => h !== href && pathname.startsWith(h) && h.length > href.length);

    return !hasMoreSpecificMatch;
  };

  // Fecha a sidebar ao navegar no mobile
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Auto-expandir menus baseados na rota atual
  useEffect(() => {
    const expandParents = (items: MenuItem[]) => {
      items.forEach((item) => {
        if (item.children) {
          const isChildActive = item.children.some((child) => (child.href ? checkActive(child.href) : false));

          if (isChildActive && !openMenus.includes(item.label)) {
            setOpenMenus((prev) => [...prev, item.label]);
          }

          // Verifica recursivamente
          expandParents(item.children);
        }
      });
    };

    expandParents(menuItems);
  }, [pathname]);

  // Filtra itens do menu baseado nas permissões do usuário e plano
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .map((item) => {
        // Se o item requer ADMIN e o usuário não é ADMIN, não exibe
        if (item.adminOnly && user?.role !== "ADMIN") {
          return null;
        }

        // Se o item tem permissão específica e o usuário não tem, não exibe
        if (item.permission && !hasPermission(item.permission)) {
          return null;
        }

        // BLOQUEIO DE PLANO FREE: só rotas permitidas
        if (currentPlan === "FREE" && item.href && !isPageAllowedForFree(item.href)) {
          return null;
        }

        // Se tem children, filtra recursivamente
        if (item.children) {
          const filteredChildren = filterMenuItems(item.children);
          if (filteredChildren.length === 0) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }

        return item;
      })
      .filter((item): item is MenuItem => item !== null);
  };

  // Filtra os itens do menu
  const visibleMenuItems = loading ? [] : filterMenuItems(menuItems);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]));
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.includes(item.label);
    // Dashboard usa match exato; demais rotas usam startsWith para marcar subrotas também
    const isActive = checkActive(item.href);
    const isParentActive = item.children?.some((child) => (child.href ? checkActive(child.href) : false));

    // Item com submenu
    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleMenu(item.label)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-colors",
              isParentActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <div className="flex items-center space-x-2 md:space-x-3">
              <AnimatedNavIcon
                icon={Icon}
                isActive={isOpen || !!isParentActive}
                animation={item.animation ?? "spring-pop"}
                className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0"
              />
              <span className="truncate">{item.label}</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
          </button>

          {/* Submenu com animação */}
          <div className={cn("overflow-hidden transition-all duration-200 ease-in-out", isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}>
            <div className="mt-1 space-y-1">{item.children?.map((child) => renderMenuItem(child, depth + 1))}</div>
          </div>
        </div>
      );
    }

    // Item sem submenu (link direto)
    const showHandoffBadge = item.label === "Conversas" && handoffsCount > 0;
    const showUnreadBadge = item.label === "Conversas" && unreadCount > 0;
    const isConversas = item.label === "Conversas";

    // Verificar se o item está bloqueado por plano
    const isPlanLocked = item.planFeature ? !hasFeature(item.planFeature) : false;
    const minPlanName = item.planFeature ? PLAN_NAMES[FEATURE_MIN_PLAN[item.planFeature]] : "";

    // Item bloqueado por plano - exibe como desabilitado com cadeado
    if (isPlanLocked) {
      return (
        <button
          key={item.href}
          onClick={() => setIsPricingModalOpen(true)}
          title={`Disponível no plano ${minPlanName}. Clique para fazer upgrade.`}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-all relative",
            "text-muted-foreground/50 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30 dark:hover:text-amber-400 cursor-pointer group",
          )}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <div className="flex items-center space-x-2 md:space-x-3 flex-1 overflow-hidden">
            <AnimatedNavIcon
              icon={Icon}
              isActive={false}
              animation={item.animation ?? "spring-pop"}
              className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0 opacity-50"
            />
            <span className="truncate opacity-60">{item.label}</span>
          </div>
          <div className="flex items-center justify-end min-w-[65px] gap-1.5">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-tight opacity-0 group-hover:opacity-100 transition-all duration-200 hidden md:block whitespace-nowrap">
              Upgrade
            </span>
            <Lock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          </div>
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href!}
        prefetch={true}
        className={cn(
          "flex items-center justify-between rounded-lg px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-all relative",
          isActive
            ? "bg-primary text-primary-foreground"
            : isConversas
              ? "bg-primary/8 text-foreground border-l-2 border-primary hover:bg-primary/15"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
        style={{ paddingLeft: isConversas && !isActive ? `${depth * 12 + 10}px` : `${depth * 12 + 12}px` }}
      >
        <div className="flex items-center space-x-2 md:space-x-3 flex-1">
          <AnimatedNavIcon
            icon={Icon}
            isActive={isActive}
            animation={item.animation ?? "spring-pop"}
            className={cn("h-4 w-4 md:h-5 md:w-5 flex-shrink-0", !isActive && isConversas && "text-primary")}
          />
          <span className={cn("truncate", !isActive && isConversas && "font-semibold")}>{item.label}</span>
        </div>

        <div className="flex items-center space-x-1">
          {/* Badge Laranja para Handoffs (Transbordo Humano) */}
          {showHandoffBadge && (
            <div
              className="flex-shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse"
              title="Transbordos não lidos"
            >
              {handoffsCount}
            </div>
          )}

          {/* Badge Verde para Notificações Gerais (Não Lidas) */}
          {showUnreadBadge && (
            <div
              className="flex-shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-full shadow-lg"
              title="Mensagens não lidas"
            >
              {unreadCount}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Overlay para mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={close}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r bg-card transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header da Sidebar */}
          <div className="flex h-16 items-center justify-between border-b px-3 lg:px-6">
            <Link href="/dashboard" prefetch={true} className="flex items-center space-x-2">
              <Image src={logo} alt="Logo" width={38} height={38} className="h-10 w-10" />
              <span className="text-xl font-bold text-zinc-700 flex">
                <span className="text-green-500">Faster</span> Chat
              </span>
            </Link>

            {/* Botão fechar - apenas mobile */}
            <button
              onClick={close}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-2 md:p-4">
            {loading ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">Carregando...</div>
            ) : (
              visibleMenuItems.map((item) => renderMenuItem(item))
            )}
          </nav>
        </div>
      </aside>

      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </>
  );
}
