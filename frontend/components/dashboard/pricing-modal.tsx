"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/constants/plans";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    try {
      setLoading(planId);
      const response = await api.post("/stripe/checkout", {
        plan: planId,
        successUrl: window.location.origin + "/dashboard?payment=success",
        cancelUrl: window.location.href, // Volta para onde o usuário estava
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-2xl">
          <DialogHeader className="mb-8 text-center">
            <DialogTitle className="text-3xl font-extrabold text-gray-900 text-center">Turbine sua operação com o plano ideal</DialogTitle>
            <DialogDescription className="text-gray-500 text-lg text-center">
              Escolha o plano que melhor se adapta ao momento do seu negócio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start pb-4">
            {PLANS.map((plan) => {
              const isCurrent = user?.plan === plan.id;

              return (
                <div key={plan.id} className="relative h-full">
                  {/* Badge "Mais Escolhido" */}
                  {plan.popular && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center z-20">
                      <span className="bg-green-500 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
                        Mais Escolhido
                      </span>
                    </div>
                  )}

                  <Card
                    className={cn(
                      "relative flex flex-col h-full transition-all duration-200 shadow-sm border-gray-100",
                      plan.popular
                        ? "border-2 border-green-500 ring-4 ring-green-500/5 shadow-green-100 shadow-xl"
                        : "border border-gray-200",
                      isCurrent && "border-2 border-green-600 ring-2 ring-green-500/20"
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <Badge className="bg-green-600 text-white font-bold border-none px-3 py-0.5 shadow-sm text-[10px]">
                          Plano Atual
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="pb-2 pt-6">
                      <CardTitle className="text-xl font-bold text-gray-900 leading-tight">
                        {plan.name}
                      </CardTitle>
                      <CardDescription className="text-gray-500 text-xs mt-1 leading-relaxed h-[90px] overflow-hidden">
                        {plan.subtitle}
                      </CardDescription>

                      <div className="flex items-baseline gap-1 mt-4">
                        <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                          {plan.price}
                        </span>
                        <span className="text-gray-400 text-xs font-medium">{plan.period}</span>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 pt-4">
                      <ul className="space-y-2.5">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            {feature.included ? (
                              <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={3} />
                            ) : (
                              <X className="h-3.5 w-3.5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                            )}
                            <span
                              className={cn(
                                "text-[13px] leading-tight",
                                feature.included ? "text-gray-700" : "text-gray-400"
                              )}
                            >
                              {feature.label}
                              {feature.badge && (
                                <span className="ml-1 text-[10px] font-semibold text-orange-500">
                                  ({feature.badge})
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter className="pt-6 pb-6">
                      <Button
                        className={cn(
                          "w-full h-11 text-sm font-bold rounded-xl transition-all duration-150",
                          isCurrent
                            ? "bg-gray-100 text-gray-400 hover:bg-gray-100 cursor-default border border-gray-200"
                            : plan.popular
                              ? "bg-green-500 hover:bg-green-600 text-white shadow-md"
                              : "bg-white border-2 border-gray-200 text-gray-700 hover:border-green-500 hover:bg-green-500 hover:text-white"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
