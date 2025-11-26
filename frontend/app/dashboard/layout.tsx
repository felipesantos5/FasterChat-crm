"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    console.log("[DASHBOARD LAYOUT] isLoading:", isLoading, "isAuthenticated:", isAuthenticated);

    // Aguarda o loading terminar antes de redirecionar
    if (isLoading) {
      console.log("[DASHBOARD LAYOUT] Aguardando loading...");
      return;
    }

    if (!isAuthenticated) {
      console.log("[DASHBOARD LAYOUT] Não autenticado, redirecionando para login");
      router.push("/login");
    } else {
      console.log("[DASHBOARD LAYOUT] Autenticado, renderizando dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Mostra loading enquanto verifica autenticação
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden pl-64">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
