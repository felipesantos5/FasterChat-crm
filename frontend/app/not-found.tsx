"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search, MessageSquare } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="text-center px-6 py-12 max-w-lg">
        {/* Ilustração do erro */}
        <div className="relative mb-8">
          <div className="text-[150px] font-bold text-primary/10 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center animate-pulse">
              <Search className="w-12 h-12 text-primary/50" />
            </div>
          </div>
        </div>

        {/* Mensagem */}
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Página não encontrada
        </h1>
        <p className="text-muted-foreground mb-8 text-lg">
          Oops! A página que você está procurando não existe ou foi movida.
        </p>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={() => router.push("/dashboard")} size="lg" className="w-full sm:w-auto">
            <Home className="mr-2 h-4 w-4" />
            Ir para Dashboard
          </Button>
          <Button onClick={() => router.push("/dashboard/conversations")} variant="outline" size="lg" className="w-full sm:w-auto">
            <MessageSquare className="mr-2 h-4 w-4" />
            Conversas
          </Button>
        </div>

        {/* Link para voltar */}
        <button
          onClick={() => window.history.back()}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Voltar à página anterior
        </button>

        {/* Decoração */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <p className="text-xs text-muted-foreground/70">
            Se você acredita que isso é um erro, entre em contato com o suporte.
          </p>
        </div>
      </div>
    </div>
  );
}
