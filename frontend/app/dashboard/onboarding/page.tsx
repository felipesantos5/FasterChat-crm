"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardApi, OnboardingStatus } from "@/lib/dashboard";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bot, Calendar, Users, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { spacing } from "@/lib/design-system";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const data = await dashboardApi.getOnboardingStatus();
        setStatus(data);

        // Se tudo estiver completo, redireciona para o dashboard principal após 2 segundos
        if (data.isComplete) {
          setTimeout(() => {
            router.push("/dashboard");
          }, 3000);
        }
      } catch (error) {
        console.error("Erro ao carregar onboarding", error);
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status?.isComplete) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center animate-in fade-in duration-700">
        <div className="rounded-full bg-green-100 p-6 mb-6">
          <Sparkles className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tudo Pronto!</h1>
        <p className="text-gray-500 max-w-md mb-8">
          Você configurou todas as etapas essenciais. Agora seu CRM está pronto para rodar no piloto automático.
        </p>
        <Button size="lg" onClick={() => router.push("/dashboard")}>
          Ir para o Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className={spacing.page}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Bem-vindo ao CRM AI</h1>
          <p className="text-gray-500">Vamos configurar sua conta para você ter o máximo de resultado.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {/* PASSO 1: WHATSAPP */}
          {!status?.whatsappConnected && (
            <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-green-600">Essencial</span>
                </div>
                <CardTitle>Conectar WhatsApp</CardTitle>
                <CardDescription>Conecte seu número para que a IA possa responder seus clientes automaticamente.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" onClick={() => router.push("/dashboard/settings/whatsapp")}>
                  Conectar Agora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* PASSO 2: CONFIGURAR IA */}
          {!status?.aiConfigured && (
            <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Bot className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-green-600">Essencial</span>
                </div>
                <CardTitle>Treinar a IA</CardTitle>
                <CardDescription>Faça upload de PDFs ou textos sobre sua empresa para a IA saber o que responder.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" variant="secondary" onClick={() => router.push("/dashboard/settings/ai")}>
                  Configurar IA <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* PASSO 3: GOOGLE CALENDAR (OPCIONAL) */}
          {!status?.calendarConnected && (
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Opcional</span>
                </div>
                <CardTitle>Conectar Agenda</CardTitle>
                <CardDescription>Integre com o Google Calendar para evitar conflitos de horários nos agendamentos.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" variant="outline" onClick={() => router.push("/dashboard/calendario")}>
                  Conectar Agenda <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* PASSO 4: IMPORTAR CLIENTES (OPCIONAL) */}
          {!status?.customersImported && (
            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Opcional</span>
                </div>
                <CardTitle>Importar Clientes</CardTitle>
                <CardDescription>Já tem uma lista de contatos? Importe seu CSV para começar campanhas.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" variant="outline" onClick={() => router.push("/dashboard/customers")}>
                  Importar CSV <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        {/* Botão de Pular para quem já sabe o que está fazendo */}
        <div className="mt-12 text-center">
          <Button variant="ghost" className="text-gray-400 hover:text-gray-600" onClick={() => router.push("/dashboard")}>
            Pular onboarding e ir para o Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
