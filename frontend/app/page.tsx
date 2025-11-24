"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    console.log('[PAGE] isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

    // Aguarda o loading terminar antes de redirecionar
    if (isLoading) {
      console.log('[PAGE] Aguardando loading...');
      return;
    }

    if (isAuthenticated) {
      console.log('[PAGE] Redirecionando para /dashboard');
      router.push("/dashboard");
    } else {
      console.log('[PAGE] Redirecionando para /login');
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">CRM com IA</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </main>
  );
}
