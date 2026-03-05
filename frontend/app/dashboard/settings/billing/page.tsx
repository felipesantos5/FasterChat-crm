"use client";

import { useAuthStore } from "@/lib/store/auth.store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, X } from "lucide-react";
import api from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// =============================================
// PLANOS - exatamente como na imagem
// =============================================
import { PLANS } from "@/lib/constants/plans";


export default function BillingPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    try {
      setLoading(planId);
      const response = await api.post("/stripe/checkout", {
        plan: planId,
        successUrl: window.location.origin + "/dashboard?payment=success",
        cancelUrl: window.location.origin + "/dashboard/settings/billing?payment=cancel",
      });

      if (response.data?.data?.url) {
        window.location.href = response.data.data.url;
      } else {
        toast.error("Erro ao gerar link de pagamento");
      }
    } catch (error: any) {
      console.error("Stripe error:", error);
      toast.error(error.response?.data?.message || "Erro ao processar assinatura");
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      setLoading("portal");
      const response = await api.post("/stripe/portal", {
        returnUrl: window.location.href,
      });
      if (response.data?.data?.url) {
        window.location.href = response.data.data.url;
      }
    } catch (error) {
      toast.error("Erro ao acessar portal do cliente");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assinatura e Planos</h1>
          <p className="text-gray-500 mt-1">Gerencie seu plano e recursos contratados na FasterChat.</p>
        </div>
        {user?.subscriptionStatus === "active" && (
          <Button
            variant="outline"
            onClick={handlePortal}
            disabled={loading === "portal"}
            className="flex items-center gap-2"
          >
            {loading === "portal" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Portal do Cliente (Faturas)
          </Button>
        )}
      </div>

      {/* Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {PLANS.map((plan) => {
          const isCurrent = user?.plan === plan.id;

          return (
            <div key={plan.id} className="relative">
              {/* Badge "Mais Escolhido" ou "Plano Atual" */}
              {plan.popular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                  <span className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide shadow-md">
                    Mais Escolhido
                  </span>
                </div>
              )}

              <Card
                className={cn(
                  "relative flex flex-col h-full transition-all duration-200 shadow-sm",
                  plan.popular
                    ? "border-2 border-green-500 shadow-green-100 shadow-lg"
                    : "border border-gray-200",
                  isCurrent && !plan.popular && "border-2 border-green-600 ring-2 ring-green-500/20",
                  plan.popular && "pt-2"
                )}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-green-600 text-white font-bold border-none px-3 py-1 shadow">
                      Plano Atual
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-2">
                  {/* Nome e subtítulo */}
                  <CardTitle className="text-xl font-bold text-gray-900 leading-tight">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-gray-500 text-sm mt-1 min-h-[40px]">
                    {plan.subtitle}
                  </CardDescription>

                  {/* Preço */}
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-4xl font-extrabold text-gray-900 tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-gray-400 text-sm font-medium">{plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pt-4">
                  {/* Lista de features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 font-bold" strokeWidth={3} />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 flex-shrink-0" strokeWidth={2.5} />
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            feature.included ? "text-gray-800" : "text-gray-400"
                          )}
                        >
                          {feature.label}
                          {feature.badge && (
                            <span className="ml-1.5 text-xs font-semibold text-orange-500">
                              ({feature.badge})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-6">
                  <Button
                    className={cn(
                      "w-full h-12 text-base font-semibold rounded-xl transition-all duration-150",
                      isCurrent
                        ? "bg-gray-100 text-gray-400 hover:bg-gray-100 cursor-default border border-gray-200"
                        : plan.popular
                          ? "bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg"
                          : "bg-white border-2 border-gray-300 text-gray-800 hover:border-green-500 hover:text-green-600"
                    )}
                    disabled={(!!loading && loading !== plan.id) || isCurrent}
                    onClick={() => !isCurrent && handleUpgrade(plan.id)}
                  >
                    {loading === plan.id ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : isCurrent ? (
                      "Plano Atual"
                    ) : (
                      plan.ctaLabel
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Info adicional */}
      <p className="text-center text-sm text-gray-400">
        Todos os planos incluem suporte e acesso ao painel completo da FasterChat.{" "}
        <span className="text-green-600 font-medium cursor-pointer underline underline-offset-2" onClick={handlePortal}>
          Gerenciar cobrança
        </span>
      </p>
    </div>
  );
}

// ===== Loader inline =====
function Loader2({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}
