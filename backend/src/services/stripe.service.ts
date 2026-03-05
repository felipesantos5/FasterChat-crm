import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { PlanTier } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_API_KEY || '', {
  apiVersion: '2024-11-20-preview' as any,
});

export class StripeService {
  /**
   * 🔗 Gera um link de checkout para um plano específico
   */
  async createCheckoutSession(companyId: string, plan: PlanTier, successUrl: string, cancelUrl: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) throw new Error('Empresa não encontrada');

    // Mapeamento de planos para IDs de Preço do Stripe (definidos no .env)
    const priceId = this.getPriceIdForPlan(plan);
    if (!priceId) throw new Error(`Preço não configurado para o plano ${plan}`);

    // Se a empresa ainda não tem um Stripe Customer ID, cria um
    let stripeCustomerId = company.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: (await prisma.user.findFirst({ where: { companyId, role: 'ADMIN' } }))?.email || undefined,
        name: company.name,
        metadata: { companyId },
      });
      stripeCustomerId = customer.id;
      
      await prisma.company.update({
        where: { id: companyId },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { companyId, plan },
    });

    return session;
  }

  /**
   * 🚀 Processa Webhooks do Stripe para atualizar planos e status no banco
   */
  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error(`[StripeWebhook] ❌ Erro de assinatura: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    console.log(`[StripeWebhook] 🟢 Evento recebido: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.companyId;
        const plan = session.metadata?.plan as PlanTier;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (companyId && plan) {
          await this.updateCompanySubscription(companyId, {
            plan,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            subscriptionStatus: 'active',
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Buscar empresa pelo customerId do stripe
        const company = await prisma.company.findUnique({
          where: { stripeCustomerId: customerId }
        });

        if (company) {
          await this.updateCompanySubscription(company.id, {
            subscriptionStatus: subscription.status,
            // Se deletado, talvez queira voltar pro plano INICIAL (opcional)
            ...(event.type === 'customer.subscription.deleted' && { 
              plan: PlanTier.INICIAL,
              stripeSubscriptionId: null 
            })
          });
        }
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        const company = await prisma.company.findUnique({
          where: { stripeCustomerId: customerId }
        });

        if (company) {
          await this.updateCompanySubscription(company.id, {
            subscriptionStatus: 'past_due'
          });
        }
        break;
      }
    }
  }

  private async updateCompanySubscription(companyId: string, data: any) {
    console.log(`[StripeService] 💾 Atualizando assinatura da empresa ${companyId}:`, data);
    await prisma.company.update({
      where: { id: companyId },
      data,
    });
  }

  private getPriceIdForPlan(plan: PlanTier): string | undefined {
    switch (plan) {
      case PlanTier.INICIAL:
        return process.env.STRIPE_PRICE_INICIAL;
      case PlanTier.NEGOCIOS:
        return process.env.STRIPE_PRICE_NEGOCIOS;
      case PlanTier.ESCALA_TOTAL:
        return process.env.STRIPE_PRICE_ESCALA_TOTAL;
      default:
        return undefined;
    }
  }

  /**
   * 🎟️ Portal do Cliente (Billing Portal)
   */
  async createPortalSession(companyId: string, returnUrl: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company?.stripeCustomerId) {
      throw new Error('Empresa não tem um registro no Stripe para acessar o portal.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: returnUrl,
    });

    return session;
  }
}

export default new StripeService();
