import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { PlanTier } from '@prisma/client';

export const checkPlanFeature = (feature: 'WORKFLOW' | 'AI_ADVANCED' | 'AI_IMAGE' | 'FLOW_TTS' | 'GOOGLE_CALENDAR' | 'CAMPAIGNS' | 'WHATSAPP_LINKS') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      // Buscar o plano atual da empresa
      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
        select: { plan: true, subscriptionStatus: true }
      });

      if (!company) {
        res.status(404).json({ success: false, message: 'Empresa não encontrada' });
        return;
      }

      // Se a assinatura não estiver ativa, bloqueia o acesso.
      // Aceita: 'active', 'trialing', 'trailing' (typo histórico mantido).
      // Bloqueia: null, 'inactive', 'canceled', 'past_due', etc.
      const status = (company as any).subscriptionStatus;
      const isActive = status === 'active' || status === 'trialing' || status === 'trailing';
      if (!isActive) {
        res.status(403).json({
          success: false,
          message: 'Sua assinatura não está ativa. Por favor, regularize seu pagamento.',
          code: 'SUBSCRIPTION_INACTIVE',
        });
        return;
      }

      const plan = (company as any).plan;

      // Lógica de Permissões por Plano
      // Baseado na tabela de preços:
      // INICIAL (R$197):   CRM, IA básica, 1 WhatsApp, Fluxos
      // NEGOCIOS (R$297):  + Campanhas, Links, 5 WhatsApp
      // ESCALA_TOTAL (R$397): + Google Agenda, Imagem IA, Áudio IA, IA avançada, WhatsApp ilimitado
      let allowed = false;

      switch (feature) {
        case 'WORKFLOW':
          // Fluxos de Automação disponíveis a partir do INICIAL
          allowed = plan === PlanTier.INICIAL || plan === PlanTier.NEGOCIOS || plan === PlanTier.ESCALA_TOTAL;
          break;

        case 'FLOW_TTS':
          // Áudio com IA no fluxo apenas no ESCALA_TOTAL
          allowed = plan === PlanTier.ESCALA_TOTAL;
          break;

        case 'CAMPAIGNS':
          // Disparador de Campanhas disponível para NEGOCIOS e ESCALA_TOTAL
          allowed = plan === PlanTier.NEGOCIOS || plan === PlanTier.ESCALA_TOTAL;
          break;

        case 'WHATSAPP_LINKS':
          // Links Rastreados disponíveis para NEGOCIOS e ESCALA_TOTAL
          allowed = plan === PlanTier.NEGOCIOS || plan === PlanTier.ESCALA_TOTAL;
          break;

        case 'AI_ADVANCED':
          // Inteligência melhorada apenas no ESCALA_TOTAL
          allowed = plan === PlanTier.ESCALA_TOTAL;
          break;

        case 'AI_IMAGE':
          // Geração de imagem apenas no ESCALA_TOTAL
          allowed = plan === PlanTier.ESCALA_TOTAL;
          break;

        case 'GOOGLE_CALENDAR':
          // Integração Google Agenda apenas no ESCALA_TOTAL (conforme tabela de planos)
          allowed = plan === PlanTier.ESCALA_TOTAL;
          break;

        default:
          allowed = false;
      }

      const featureNames: Record<string, string> = {
        WORKFLOW: 'Fluxos de Automação',
        CAMPAIGNS: 'Campanhas',
        WHATSAPP_LINKS: 'Links Rastreados',
        AI_ADVANCED: 'IA Avançada',
        AI_IMAGE: 'Geração de Imagens com IA',
        FLOW_TTS: 'Áudio com IA no Fluxo',
        GOOGLE_CALENDAR: 'Google Agenda',
      };
      const featureName = featureNames[feature] || feature;

      if (!allowed) {
        res.status(403).json({
          success: false,
          message: `"${featureName}" não está disponível no seu plano atual. Faça upgrade para acessar este recurso.`,
          code: 'PLAN_RESTRICTION'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[PlanMiddleware] Error:', error);
      res.status(500).json({ success: false, message: 'Erro ao verificar plano da empresa' });
    }
  };
};
