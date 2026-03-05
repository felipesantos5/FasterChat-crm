import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { PlanTier } from '@prisma/client';
import { authService } from './auth.service';
import { emailService } from './email.service';

const stripe = new Stripe(process.env.STRIPE_API_KEY || '', {
  apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
});

interface CompanySubscriptionUpdate {
  plan?: PlanTier;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string;
  subscriptionStatus?: string;
}

export class StripeService {
  /**
   * Gera link de checkout para cliente existente (upgrade de plano).
   */
  async createCheckoutSession(
    companyId: string,
    plan: PlanTier,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error('Empresa não encontrada');

    const priceId = this.getPriceIdForPlan(plan);
    if (!priceId) throw new Error(`Preço não configurado para o plano ${plan}`);

    let stripeCustomerId = (company as any).stripeCustomerId;
    if (!stripeCustomerId) {
      const admin = await prisma.user.findFirst({ where: { companyId, role: 'ADMIN' } });
      const customer = await stripe.customers.create({
        email: admin?.email,
        name: company.name,
        metadata: { companyId },
      });
      stripeCustomerId = customer.id;
      await prisma.company.update({
        where: { id: companyId },
        data: { stripeCustomerId },
      });
    }

    return stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { companyId, plan },
    });
  }

  /**
   * Gera link de checkout para novo lead vindo da landing page (sem conta ainda).
   */
  async createPublicCheckoutSession(params: {
    email: string;
    name: string;
    companyName: string;
    plan: PlanTier;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    const { email, name, companyName, plan, successUrl, cancelUrl } = params;

    const priceId = this.getPriceIdForPlan(plan);
    if (!priceId) throw new Error(`Preço não configurado para o plano ${plan}`);

    // Reusa customer existente no Stripe se já tiver comprado antes
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    const customer = existingCustomers.data[0]
      ? existingCustomers.data[0]
      : await stripe.customers.create({ email, name });

    return stripe.checkout.sessions.create({
      customer: customer.id,
      customer_update: { name: 'auto' },
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Metadados para criação de conta no webhook
      metadata: { email, name, companyName, plan },
    });
  }

  /**
   * Processa webhooks do Stripe.
   */
  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      throw new Error(`Webhook Error: ${message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { companyId, plan, email, name, companyName } = session.metadata ?? {};
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    if (companyId && plan) {
      // Cliente existente fazendo upgrade
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      await this.updateCompanySubscription(companyId, {
        plan: plan as PlanTier,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        subscriptionStatus: 'active',
      });

      if (company && (company as any).plan !== (plan as PlanTier)) {
        const admin = await prisma.user.findFirst({ where: { companyId, role: 'ADMIN' } });
        if (admin) {
          await emailService.sendUpgradeEmail({
            to: admin.email,
            name: admin.name,
            oldPlan: (company as any).plan,
            newPlan: plan,
          });
        }
      }
      return;
    }

    if (email && name && companyName && plan) {
      // Novo cliente vindo da landing page — cria conta
      const existingUser = await prisma.user.findFirst({ where: { email } });

      if (existingUser) {
        // Já tem conta — atualiza assinatura da empresa existente
        await this.updateCompanySubscription(existingUser.companyId, {
          plan: plan as PlanTier,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          subscriptionStatus: 'active',
        });
        return;
      }

      const { tempPassword } = await authService.createAccountFromCheckout({
        email,
        name,
        companyName,
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });

      await emailService.sendWelcomeEmail({ to: email, name, companyName, tempPassword, plan });
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const company = await prisma.company.findUnique({ where: { stripeCustomerId: customerId } });
    if (!company) return;

    const priceId = subscription.items.data[0]?.price.id;
    const newPlan = priceId ? this.getPlanForPriceId(priceId) : undefined;

    await this.updateCompanySubscription(company.id, {
      subscriptionStatus: subscription.status,
      ...(newPlan !== undefined && { plan: newPlan }),
    });

    if (newPlan && newPlan !== (company as any).plan) {
      const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } });
      if (admin) {
        await emailService.sendUpgradeEmail({
          to: admin.email,
          name: admin.name,
          oldPlan: (company as any).plan,
          newPlan,
        });
      }
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const company = await prisma.company.findUnique({ where: { stripeCustomerId: customerId } });
    if (!company) return;

    await this.updateCompanySubscription(company.id, {
      plan: PlanTier.FREE,
      stripeSubscriptionId: null,
      subscriptionStatus: 'canceled',
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const company = await prisma.company.findUnique({ where: { stripeCustomerId: customerId } });
    if (!company) return;

    await this.updateCompanySubscription(company.id, { subscriptionStatus: 'past_due' });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const company = await prisma.company.findUnique({ where: { stripeCustomerId: customerId } });
    if (!company) return;

    // Só reativa se estava inadimplente
    if ((company as any).subscriptionStatus === 'past_due') {
      await this.updateCompanySubscription(company.id, { subscriptionStatus: 'active' });
    }
  }

  /**
   * Portal de gerenciamento de assinatura (Billing Portal).
   */
  async createPortalSession(companyId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!(company as any).stripeCustomerId) {
      throw new Error('Empresa não tem registro no Stripe para acessar o portal.');
    }

    return stripe.billingPortal.sessions.create({
      customer: (company as any).stripeCustomerId,
      return_url: returnUrl,
    });
  }

  private async updateCompanySubscription(
    companyId: string,
    data: CompanySubscriptionUpdate
  ): Promise<void> {
    await prisma.company.update({ where: { id: companyId }, data });
  }

  private getPriceIdForPlan(plan: PlanTier): string | undefined {
    const map: Record<PlanTier, string | undefined> = {
      [PlanTier.FREE]: undefined,
      [PlanTier.INICIAL]: process.env.STRIPE_PRICE_INICIAL,
      [PlanTier.NEGOCIOS]: process.env.STRIPE_PRICE_NEGOCIOS,
      [PlanTier.ESCALA_TOTAL]: process.env.STRIPE_PRICE_ESCALA_TOTAL,
    };
    return map[plan];
  }

  private getPlanForPriceId(priceId: string): PlanTier | undefined {
    if (priceId === process.env.STRIPE_PRICE_INICIAL) return PlanTier.INICIAL;
    if (priceId === process.env.STRIPE_PRICE_NEGOCIOS) return PlanTier.NEGOCIOS;
    if (priceId === process.env.STRIPE_PRICE_ESCALA_TOTAL) return PlanTier.ESCALA_TOTAL;
    return undefined;
  }
}

export default new StripeService();
