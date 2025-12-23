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
  Smartphone,
  BookOpen,
  ChevronDown,
  BarChart3,
  Megaphone,
  CalendarDays,
  Link2,
  FunnelPlus,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import logo from "@/assets/logo2.webp";
import { useSidebar } from "@/contexts/SidebarContext";

// Tipo para os itens de menu
interface MenuItem {
  label: string;
  icon: any;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Clientes",
    icon: Users,
    href: "/dashboard/customers",
  },
  {
    label: "Conversas",
    icon: MessageSquare,
    href: "/dashboard/conversations",
  },
  {
    label: "Funil",
    icon: FunnelPlus,
    href: "/dashboard/pipeline",
  },
  {
    label: "Calendário",
    icon: CalendarDays,
    href: "/dashboard/calendario",
  },
  {
    label: "Campanhas",
    icon: Megaphone,
    href: "/dashboard/campaigns",
  },
  {
    label: "Links de WhatsApp",
    icon: Link2,
    href: "/dashboard/links",
  },
  {
    label: "Configurações",
    icon: Settings,
    children: [
      {
        label: "IA",
        icon: Bot,
        href: "/dashboard/settings/ai",
      },
      {
        label: "WhatsApp",
        icon: Smartphone,
        href: "/dashboard/settings/whatsapp",
      },
    ],
  },
  {
    label: "IA",
    icon: Bot,
    children: [
      {
        label: "Insights",
        icon: BarChart3,
        href: "/dashboard/ai/insights",
      },
      {
        label: "Exemplos de Conversas",
        icon: BookOpen,
        href: "/dashboard/ai/examples",
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const { isOpen, close } = useSidebar();

  // Fecha a sidebar ao navegar no mobile
  useEffect(() => {
    close();
  }, [pathname, close]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]));
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.includes(item.label);
    const isActive = item.href === pathname;
    const isParentActive = item.children?.some((child) => child.href === pathname);

    // Item com submenu
    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleMenu(item.label)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isParentActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <div className="flex items-center space-x-3">
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
          </button>

          {/* Submenu com animação */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-in-out",
              isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="mt-1 space-y-1">{item.children?.map((child) => renderMenuItem(child, depth + 1))}</div>
          </div>
        </div>
      );
    }

    // Item sem submenu (link direto)
    return (
      <Link
        key={item.href}
        href={item.href!}
        prefetch={true}
        className={cn(
          "flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <Icon className="h-5 w-5" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Overlay para mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={close}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-72 border-r bg-card transition-transform duration-300 ease-in-out",
          "lg:w-64 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header da Sidebar */}
          <div className="flex h-16 items-center justify-between border-b px-4 lg:px-6">
            <Link href="/dashboard" prefetch={true} className="flex items-center space-x-2">
              <Image src={logo} alt="Logo" width={55} height={55} />
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
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">{menuItems.map((item) => renderMenuItem(item))}</nav>
        </div>
      </aside>
    </>
  );
}
