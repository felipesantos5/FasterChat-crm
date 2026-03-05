"use client";

import { useRouter } from "next/navigation";
import { Lock, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanFeatures, PlanFeature, FEATURE_LABELS, PLAN_NAMES, FEATURE_MIN_PLAN } from "@/hooks/usePlanFeatures";
import { cn } from "@/lib/utils";

interface PlanGateProps {
  /** Feature que precisa ser verificada */
  feature: PlanFeature;
  /** Conteúdo a ser renderizado se o plano permitir */
  children: React.ReactNode;
  /** Modo de exibição quando bloqueado */
  mode?: "redirect" | "overlay" | "hidden" | "inline";
  /** Mensagem customizada quando bloqueado */
  message?: string;
  /** Classe CSS adicional para o wrapper */
  className?: string;
}

/**
 * PlanGate - Componente que bloqueia acesso a features baseado no plano da conta.
 *
 * Modes:
 * - "redirect": Redireciona para /dashboard/settings/billing (default para páginas)
 * - "overlay": Renderiza o conteúdo com um overlay de bloqueio (bom para seções)
 * - "hidden": Não renderiza nada se bloqueado (silencioso)
 * - "inline": Renderiza um card inline de upgrade sem esconder o conteúdo
 */
export function PlanGate({
  feature,
  children,
  mode = "overlay",
  message,
  className,
}: PlanGateProps) {
  const { hasFeature, currentPlanName, isLoading } = usePlanFeatures();
  const router = useRouter();
  const allowed = hasFeature(feature);

  if (allowed || isLoading) {
    return <>{children}</>;
  }

  const minPlan = FEATURE_MIN_PLAN[feature];
  const minPlanLabel = PLAN_NAMES[minPlan];
  const featureLabel = FEATURE_LABELS[feature];
  const defaultMessage = message ?? `${featureLabel} está disponível a partir do plano ${minPlanLabel}.`;

  if (mode === "hidden") {
    return null;
  }

  if (mode === "redirect") {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-[400px] text-center p-8", className)}>
        <UpgradeBanner
          featureLabel={featureLabel}
          message={defaultMessage}
          minPlanName={minPlanLabel}
          onUpgrade={() => router.push("/dashboard/settings/billing")}
          large
        />
      </div>
    );
  }

  if (mode === "inline") {
    return (
      <div className={cn("space-y-4", className)}>
        <UpgradeBanner
          featureLabel={featureLabel}
          message={defaultMessage}
          minPlanName={minPlanLabel}
          onUpgrade={() => router.push("/dashboard/settings/billing")}
        />
        <div className="opacity-30 pointer-events-none select-none">
          {children}
        </div>
      </div>
    );
  }

  // Mode: overlay
  return (
    <div className={cn("relative", className)}>
      {/* Conteúdo bloqueado com blur */}
      <div className="pointer-events-none select-none blur-[3px] opacity-40">
        {children}
      </div>

      {/* Overlay de upgrade */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-white/95 dark:bg-gray-900/95 border shadow-xl rounded-2xl p-6 max-w-sm mx-4 text-center backdrop-blur-sm">
          <div className="flex justify-center mb-3">
            <div className="bg-amber-100 dark:bg-amber-900/40 rounded-full p-3">
              <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Recurso Bloqueado
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {defaultMessage}
          </p>
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
            onClick={() => router.push("/dashboard/settings/billing")}
          >
            <Zap className="mr-2 h-4 w-4" />
            Fazer Upgrade para {minPlanLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Seu plano atual: <span className="font-medium">{currentPlanName}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== Banner de upgrade standalone (usado internamente e pode ser usado externamente) =====

interface UpgradeBannerProps {
  featureLabel: string;
  message: string;
  minPlanName: string;
  onUpgrade: () => void;
  large?: boolean;
}

export function UpgradeBanner({ featureLabel, message, onUpgrade, large }: UpgradeBannerProps) {
  return (
    <div className={cn(
      "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-center",
      large ? "p-10 max-w-md mx-auto" : "p-6"
    )}>
      <div className="flex justify-center mb-4">
        <div className={cn(
          "bg-amber-100 dark:bg-amber-900/40 rounded-full",
          large ? "p-4" : "p-3"
        )}>
          <Lock className={cn("text-amber-600 dark:text-amber-400", large ? "h-8 w-8" : "h-6 w-6")} />
        </div>
      </div>

      <h3 className={cn("font-bold text-gray-900 dark:text-gray-100 mb-2", large ? "text-2xl" : "text-lg")}>
        {featureLabel}
      </h3>

      <p className={cn("text-gray-600 dark:text-gray-400 mb-6", large ? "text-base" : "text-sm")}>
        {message}
      </p>

      <Button
        onClick={onUpgrade}
        className={cn(
          "bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md hover:shadow-lg transition-all",
          large ? "h-12 px-8 text-base" : "h-10 px-6"
        )}
      >
        <Zap className="mr-2 h-4 w-4" />
        Ver Planos e Fazer Upgrade
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
