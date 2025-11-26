"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Bot,
  Smartphone,
  BookOpen,
  ChevronDown,
  BarChart3,
  Megaphone,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    label: "Campanhas",
    icon: Megaphone,
    href: "/dashboard/campaigns",
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
  const router = useRouter();
  const { logout } = useAuthStore();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
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
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isParentActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <div className="flex items-center space-x-3">
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </button>

          {/* Submenu */}
          {isOpen && (
            <div className="mt-1 space-y-1">
              {item.children?.map((child) => renderMenuItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Item sem submenu (link direto)
    return (
      <Link
        key={item.href}
        href={item.href!}
        className={cn(
          "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <Icon className="h-5 w-5" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">C</span>
            </div>
            <span className="text-xl font-bold">CRM IA</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>

        {/* Logout */}
        <div className="border-t p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
