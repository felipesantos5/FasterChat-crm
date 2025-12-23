"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { SidebarProvider } from "@/contexts/SidebarContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

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
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <Sidebar />

          {/* Main Content - responsivo */}
          <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
            <Header />
            <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </WebSocketProvider>
  );
}
