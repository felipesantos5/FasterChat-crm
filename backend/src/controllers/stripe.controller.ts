import { Request, Response } from 'express';
import stripeService from '../services/stripe.service';
// import { PlanTier } from "@prisma/client";
// Definindo localmente até o Prisma Client sincronizar
const PlanTier = {
  INICIAL: "INICIAL",
  NEGOCIOS: "NEGOCIOS",
  ESCALA_TOTAL: "ESCALA_TOTAL",
} as any;
type PlanTier = "INICIAL" | "NEGOCIOS" | "ESCALA_TOTAL";

class StripeController {
  /**
   * POST /api/stripe/checkout
   */
  async createCheckout(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const { plan, successUrl, cancelUrl } = req.body;

      if (!plan || !Object.values(PlanTier).includes(plan as PlanTier)) {
        return res.status(400).json({ success: false, message: 'Plano inválido' });
      }

      const session = await stripeService.createCheckoutSession(
        req.user.companyId,
        plan as PlanTier,
        successUrl,
        cancelUrl
      );

      return res.status(200).json({
        success: true,
        data: { url: session.url },
      });
    } catch (error: any) {
      console.error('[StripeController] Error createCheckout:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/stripe/portal
   */
  async createPortal(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const { returnUrl } = req.body;
      const session = await stripeService.createPortalSession(req.user.companyId, returnUrl);

      return res.status(200).json({
        success: true,
        data: { url: session.url },
      });
    } catch (error: any) {
      console.error('[StripeController] Error createPortal:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/stripe/webhook
   * Rota pública (chamada pelo Stripe)
   */
  async webhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;

    try {
      // O raw body é necessário para verificar a assinatura do webhook
      // Usamos req.body se o express.raw() estiver configurado, mas no Express 4.x
      // geralmente precisamos de um middleware específico ou usar o body bruto.
      // Assumindo que o payload já é o Buffer ou será tratado.
      await stripeService.handleWebhook(sig, req.body);
      
      return res.status(200).send({ received: true });
    } catch (err: any) {
      console.error(`[StripeController] Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
}

export default new StripeController();
