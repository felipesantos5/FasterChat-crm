"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth.store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DashboardFilterProvider } from "@/contexts/DashboardFilterContext";
import { usePlanFeatures, isPageAllowedForFree } from "@/hooks/usePlanFeatures";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { currentPlan } = usePlanFeatures();
  const isPastDue = user?.subscriptionStatus === "past_due";
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    // Se for FREE e tentar acessar rota não permitida, redireciona para dashboard
    if (currentPlan === "FREE" && !isPageAllowedForFree(pathname)) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router, currentPlan, pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <WebSocketProvider>
      <SidebarProvider>
        <DashboardFilterProvider>
          <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar />

            {/* Main Content - responsivo */}
            <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
              {isPastDue && (
                <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2.5 text-white text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Pagamento pendente — sua assinatura está com problemas. Atualize seu método de pagamento para evitar a suspensão do plano.</span>
                  </div>
                  <Link
                    href="/dashboard/settings/billing"
                    className="flex-shrink-0 underline underline-offset-2 hover:text-amber-100 transition-colors"
                  >
                    Regularizar agora
                  </Link>
                </div>
              )}
              <Header />
              <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
            </div>
          </div>
        </DashboardFilterProvider>
      </SidebarProvider>
    </WebSocketProvider>
  );
}
