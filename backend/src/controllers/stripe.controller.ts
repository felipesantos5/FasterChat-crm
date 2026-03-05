import { Request, Response } from 'express';
import { PlanTier } from '@prisma/client';
import stripeService from '../services/stripe.service';

const VALID_PLANS = Object.values(PlanTier);

class StripeController {
  /**
   * POST /api/stripe/checkout
   * Para cliente autenticado fazendo upgrade de plano.
   */
  async createCheckout(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const { plan, successUrl, cancelUrl } = req.body;

      if (!plan || !VALID_PLANS.includes(plan as PlanTier)) {
        return res.status(400).json({ success: false, message: 'Plano inválido' });
      }
      if (!successUrl || !cancelUrl) {
        return res.status(400).json({ success: false, message: 'successUrl e cancelUrl são obrigatórios' });
      }

      const session = await stripeService.createCheckoutSession(
        req.user.companyId,
        plan as PlanTier,
        successUrl,
        cancelUrl
      );

      return res.status(200).json({ success: true, data: { url: session.url } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro interno';
      console.error('[StripeController] Error createCheckout:', error);
      return res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/stripe/checkout/public
   * Para novo lead vindo da landing page (sem conta).
   */
  async createPublicCheckout(req: Request, res: Response) {
    try {
      const { email, name, companyName, plan, successUrl, cancelUrl } = req.body;

      if (!email || !name || !companyName || !plan) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: email, name, companyName, plan',
        });
      }
      if (!VALID_PLANS.includes(plan as PlanTier)) {
        return res.status(400).json({ success: false, message: 'Plano inválido' });
      }

      const session = await stripeService.createPublicCheckoutSession({
        email,
        name,
        companyName,
        plan: plan as PlanTier,
        successUrl: successUrl || `${process.env.APP_URL || ''}/sucesso`,
        cancelUrl: cancelUrl || `${process.env.APP_URL || ''}/cancelado`,
      });

      return res.status(200).json({ success: true, data: { url: session.url } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro interno';
      console.error('[StripeController] Error createPublicCheckout:', error);
      return res.status(500).json({ success: false, message });
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
      if (!returnUrl) {
        return res.status(400).json({ success: false, message: 'returnUrl é obrigatório' });
      }

      const session = await stripeService.createPortalSession(req.user.companyId, returnUrl);

      return res.status(200).json({ success: true, data: { url: session.url } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro interno';
      console.error('[StripeController] Error createPortal:', error);
      return res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/stripe/webhook
   * Rota pública chamada pelo Stripe — raw body obrigatório.
   */
  async webhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      return res.status(400).json({ error: 'stripe-signature header ausente' });
    }

    try {
      await stripeService.handleWebhook(sig, req.body as Buffer);
      return res.status(200).json({ received: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`[StripeController] Webhook Error: ${message}`);
      return res.status(400).send(`Webhook Error: ${message}`);
    }
  }
}

export default new StripeController();
