"use client";

import { useAuthStore } from "@/lib/store/auth.store";
import { PlanTier } from "@/types/auth";

/**
 * Features disponíveis por plano:
 *
 * INICIAL / Essencial (R$ 197/mês):
 *   ✅ 1 WhatsApp Conectado
 *   ✅ Gestão de Clientes (CRM)
 *   ✅ Atendente Virtual com IA
 *   ✅ Fluxos de Automação
 *   ❌ Disparador de campanhas
 *   ❌ Rastreamento Inteligente de Links
 *   ❌ Integração com Google Agenda
 *   ❌ Geração de Imagem com IA no Fluxo
 *   ❌ Áudio com IA no Fluxo
 *
 * NEGOCIOS / Growth (R$ 297/mês):
 *   ✅ 5 WhatsApp Conectados
 *   ✅ Gestão de Clientes (CRM)
 *   ✅ Atendente Virtual com IA
 *   ✅ Fluxos de Automação
 *   ✅ Disparador de campanhas
 *   ✅ Rastreamento Inteligente de Links
 *   ❌ Integração com Google Agenda
 *   ❌ Geração de Imagem com IA no Fluxo
 *   ❌ Áudio com IA no Fluxo
 *
 * ESCALA_TOTAL / Performance Máxima (R$ 397/mês):
 *   ✅ WhatsApp Ilimitado
 *   ✅ Gestão de Clientes (CRM)
 *   ✅ Atendente Virtual com IA (melhorada)
 *   ✅ Fluxos de Automação
 *   ✅ Disparador de campanhas
 *   ✅ Rastreamento Inteligente de Links
 *   ✅ Integração com Google Agenda
 *   ✅ Geração de Imagem com IA no Fluxo
 *   ✅ Áudio com IA no Fluxo (ElevenLabs)
 */

export type PlanFeature =
  | "CAMPAIGNS"       // Disparador de campanhas
  | "WHATSAPP_LINKS"  // Rastreamento Inteligente de Links
  | "GOOGLE_CALENDAR" // Integração com Google Agenda
  | "AI_IMAGE"        // Geração de Imagem com IA no fluxo
  | "WORKFLOW"        // Fluxos de Automação
  | "FLOW_TTS"        // Áudio com IA no fluxo (ElevenLabs)
  | "AI_ADVANCED";    // IA Avançada (melhorada)

// Mapa de quais planos têm acesso a cada feature
const PLAN_FEATURE_MAP: Record<PlanFeature, PlanTier[]> = {
  CAMPAIGNS: ["NEGOCIOS", "ESCALA_TOTAL"],
  WHATSAPP_LINKS: ["NEGOCIOS", "ESCALA_TOTAL"],
  GOOGLE_CALENDAR: ["ESCALA_TOTAL"],
  AI_IMAGE: ["ESCALA_TOTAL"],
  WORKFLOW: ["INICIAL", "NEGOCIOS", "ESCALA_TOTAL"],
  FLOW_TTS: ["ESCALA_TOTAL"],
  AI_ADVANCED: ["ESCALA_TOTAL"],
};

// Rotas permitidas para o plano FREE
export const FREE_ALLOWED_PAGES = ["/dashboard", "/dashboard/customers", "/dashboard/conversations", "/dashboard/settings", "/dashboard/pipeline"];

// Função utilitária para checar acesso de rota
export function isPageAllowedForFree(path: string): boolean {
  return FREE_ALLOWED_PAGES.some((allowed) => path === allowed || path.startsWith(allowed + "/"));
}

// Mapa de nomes amigáveis para cada feature
export const FEATURE_LABELS: Record<PlanFeature, string> = {
  CAMPAIGNS: "Disparador de Campanhas",
  WHATSAPP_LINKS: "Rastreamento Inteligente de Links",
  GOOGLE_CALENDAR: "Integração com Google Agenda",
  AI_IMAGE: "Geração de Imagem com IA no Fluxo",
  WORKFLOW: "Fluxos de Automação",
  FLOW_TTS: "Áudio com IA no Fluxo",
  AI_ADVANCED: "IA Avançada",
};

// Plano mínimo necessário para cada feature
export const FEATURE_MIN_PLAN: Record<PlanFeature, PlanTier> = {
  CAMPAIGNS: "NEGOCIOS",
  WHATSAPP_LINKS: "NEGOCIOS",
  GOOGLE_CALENDAR: "ESCALA_TOTAL",
  AI_IMAGE: "ESCALA_TOTAL",
  WORKFLOW: "INICIAL",
  FLOW_TTS: "ESCALA_TOTAL",
  AI_ADVANCED: "ESCALA_TOTAL",
};

// Nomes amigáveis dos planos
export const PLAN_NAMES: Record<PlanTier, string> = {
  FREE: "Free",
  INICIAL: "Inicial",
  NEGOCIOS: "Negócios 100% Automáticos",
  ESCALA_TOTAL: "Escala Total",
};

// Preços dos planos
export const PLAN_PRICES: Record<PlanTier, string> = {
  FREE: "Grátis",
  INICIAL: "R$ 197/mês",
  NEGOCIOS: "R$ 297/mês",
  ESCALA_TOTAL: "R$ 397/mês",
};

export function usePlanFeatures() {
  const { user, isLoading, isRefreshing } = useAuthStore();
  const currentPlan = (user?.plan || "FREE") as PlanTier;
  const subscriptionStatus = user?.subscriptionStatus;

  const isSubscriptionActive =
    !subscriptionStatus || // Sem status = permissivo (usuário novo ou sem stripe)
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing" ||
    subscriptionStatus === "trailing"; // typo histórico mantido para compatibilidade

  /**
   * Verifica se a feature está disponível para o plano atual
   */
  const hasFeature = (feature: PlanFeature): boolean => {
    // Se ainda está carregando o usuário INITIAL, retorna true para evitar "flicker" de cadeado
    if (isLoading) return true;

    // Se estamos REFRESCANDO (background getMe) e o plano atual parece ser o inicial/vazio,
    // retornamos true para evitar que cadeados apareçam se o usuário for pago (devido a cache antigo ou bug de me)
    if (isRefreshing && !user?.plan) return true;

    if (!isSubscriptionActive) return false;
    const allowedPlans = PLAN_FEATURE_MAP[feature];
    return allowedPlans.includes(currentPlan);
  };

  /**
   * Retorna o plano mínimo necessário para acessar a feature
   */
  const getMinPlan = (feature: PlanFeature): PlanTier => {
    return FEATURE_MIN_PLAN[feature];
  };

  /**
   * Retorna o nome amigável do plano atual
   */
  const currentPlanName = PLAN_NAMES[currentPlan] ?? "Free";

  return {
    currentPlan,
    currentPlanName,
    hasFeature,
    getMinPlan,
    isSubscriptionActive,
    isLoading,
    isRefreshing,
  };
}
