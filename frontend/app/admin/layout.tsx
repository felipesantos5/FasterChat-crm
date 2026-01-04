"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdminAuthStore } from "@/lib/store/admin-auth.store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, loadToken } = useAdminAuthStore();

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  useEffect(() => {
    if (isLoading) return;

    // Se não está autenticado e não está na página de login, redireciona
    if (!isAuthenticated && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Se está carregando, mostra loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
