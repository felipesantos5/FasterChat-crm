"use client";

import Link from "next/link";
import { Bot, Smartphone, Users, DollarSign, Zap, SlidersHorizontal, CreditCard } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store/auth.store";

const settingsItems = [
  {
    label: "Inteligência Artificial",
    description: "Configure o comportamento da IA, base de conhecimento e respostas automáticas",
    icon: Bot,
    href: "/dashboard/settings/ai",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    label: "WhatsApp",
    description: "Gerencie instâncias conectadas e configurações de envio",
    icon: Smartphone,
    href: "/dashboard/settings/whatsapp",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    label: "Colaboradores",
    description: "Gerencie membros da equipe, convites e permissões de acesso",
    icon: Users,
    href: "/dashboard/settings/colaboradores",
    color: "text-blue-600",
    bg: "bg-blue-50",
    adminOnly: true,
  },
  {
    label: "Scripts de Atendimento",
    description: "Crie e edite scripts para guiar o atendimento da IA",
    icon: Zap,
    href: "/dashboard/settings/ai/scripts",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    label: "Campos Personalizados",
    description: "Defina campos extras para enriquecer o perfil dos clientes",
    icon: SlidersHorizontal,
    href: "/dashboard/settings/custom-fields",
    color: "text-teal-600",
    bg: "bg-teal-50",
  },
  {
    label: "Precificação",
    description: "Configure preços, serviços e combos oferecidos",
    icon: DollarSign,
    href: "/dashboard/settings/pricing",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    label: "Assinatura",
    description: "Visualize e gerencie seu plano e dados de faturamento",
    icon: CreditCard,
    href: "/dashboard/settings/billing",
    color: "text-slate-600",
    bg: "bg-slate-50",
    adminOnly: true,
  },
];

export default function SettingsPage() {
  const { user } = useAuthStore();

  const visibleItems = settingsItems.filter(
    (item) => !item.adminOnly || user?.role === "ADMIN"
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações da sua empresa</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className={`p-2.5 rounded-lg ${item.bg} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                    <CardDescription className="text-sm mt-1">{item.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
