import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import type { CreateCheckoutDto } from './dto/billing.dto';

// Stripe importado dinamicamente para evitar problemas de tipos no strict mode
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib = require('stripe') as { new (key: string): StripeClient };

interface StripeClient {
  checkout: { sessions: { create: (params: unknown) => Promise<{ url: string | null }> } };
  billingPortal: { sessions: { create: (params: unknown) => Promise<{ url: string }> } };
  webhooks: { constructEvent: (body: Buffer, sig: string, secret: string) => StripeEvent };
}

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

interface CondoRow {
  id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status: string;
  name: string;
  past_due_since?: string | null;
  trial_ends_at?: string | null;
}

export interface BillingStatusResult {
  subscription_status: string;
  plan_name: string;
  plan_price_monthly: number | null;
  trial_ends_at: string | null;
  past_due_since: string | null;
  days_until_blocked: number | null;
  stripe_customer_id: string | null;
  usage: {
    units: number;
    max_units: number;
    residents: number;
    max_residents: number;
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: StripeClient | null;
  private readonly webhookSecret: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = stripeKey ? new StripeLib(stripeKey) : null;
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  private get stripeClient(): StripeClient {
    if (!this.stripe) throw new BadRequestException('Stripe não configurado');
    return this.stripe;
  }

  async createCheckoutSession(condoId: string, dto: CreateCheckoutDto): Promise<{ url: string }> {
    const supabase = this.supabaseService.getAdminClient();

    const { data: condo } = await supabase
      .from('condominiums')
      .select('id, name, stripe_customer_id')
      .eq('id', condoId)
      .single();

    if (!condo) throw new BadRequestException('Condomínio não encontrado');
    const condoRow = condo as CondoRow;

    if (!dto.plan_id && !dto.plan_name) {
      throw new BadRequestException('Forneça plan_id ou plan_name');
    }

    const { data: plan } = dto.plan_id
      ? await supabase.from('plans').select('stripe_price_id, name').eq('id', dto.plan_id).single()
      : await supabase.from('plans').select('stripe_price_id, name').eq('name', dto.plan_name!).single();

    if (!plan) throw new BadRequestException('Plano não encontrado');
    const planRow = plan as { stripe_price_id: string; name: string };

    if (!planRow.stripe_price_id) {
      throw new BadRequestException('Plano sem price_id do Stripe configurado');
    }

    const appUrl = this.configService.get<string>('WEB_URL') ?? 'http://localhost:5173';

    const session = await this.stripeClient.checkout.sessions.create({
      mode: 'subscription',
      customer: condoRow.stripe_customer_id ?? undefined,
      customer_creation: condoRow.stripe_customer_id ? undefined : 'always',
      line_items: [{ price: planRow.stripe_price_id, quantity: 1 }],
      success_url: dto.success_url ?? `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: dto.cancel_url ?? `${appUrl}/billing/cancel`,
      metadata: { condominium_id: condoId },
    });

    if (!session.url) throw new BadRequestException('Falha ao criar sessão de checkout');
    return { url: session.url };
  }

  async createPortalSession(condoId: string): Promise<{ url: string }> {
    const { data: condo } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('stripe_customer_id')
      .eq('id', condoId)
      .single();

    const customerId = (condo as CondoRow | null)?.stripe_customer_id;
    if (!customerId) throw new BadRequestException('Assinatura Stripe não encontrada');

    const appUrl = this.configService.get<string>('WEB_URL') ?? 'http://localhost:5173';
    const session = await this.stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/billing`,
    });

    return { url: session.url };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: StripeEvent;
    try {
      event = this.stripeClient.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new BadRequestException('Assinatura do webhook inválida');
    }

    const obj = event.data.object;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.syncSubscription(obj);
        break;
      case 'customer.subscription.deleted':
        await this.cancelSubscription(obj);
        break;
      case 'invoice.payment_failed':
        await this.markPastDue(obj['subscription'] as string);
        break;
      case 'invoice.payment_succeeded':
        await this.clearPastDue(obj['subscription'] as string);
        break;
      default:
        this.logger.debug(`Evento Stripe não tratado: ${event.type}`);
    }
  }

  async handleAsaasWebhook(payload: Record<string, unknown>): Promise<void> {
    const eventName = payload['event'] as string;
    const payment = payload['payment'] as Record<string, unknown>;
    if (!eventName || !payment) return;

    const condoId = payment['externalReference'] as string;
    if (!condoId) return;

    switch (eventName) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await this.supabaseService
          .getAdminClient()
          .from('condominiums')
          .update({ subscription_status: 'active', past_due_since: null })
          .eq('id', condoId);
        break;
      case 'PAYMENT_OVERDUE':
        await this.supabaseService
          .getAdminClient()
          .from('condominiums')
          .update({ subscription_status: 'past_due', past_due_since: new Date().toISOString() })
          .eq('id', condoId);
        break;
    }
  }

  async listPlans(): Promise<unknown[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('plans')
      .select('id, name, price_monthly, features')
      .order('price_monthly', { ascending: true });
    return data ?? [];
  }

  async getStatus(condoId: string): Promise<BillingStatusResult> {
    const supabase = this.supabaseService.getAdminClient();

    const { data: condo } = await supabase
      .from('condominiums')
      .select('*, plans(name, price_monthly)')
      .eq('id', condoId)
      .single();

    if (!condo) throw new BadRequestException('Condomínio não encontrado');
    const c = condo as CondoRow & { plans?: { name: string; price_monthly: number } | null };

    // Contagem de uso
    const [{ count: unitsCount }, { count: residentsCount }] = await Promise.all([
      supabase.from('units').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('condominium_id', condoId).eq('role', 'morador').eq('active', true),
    ]);

    const planName = c.plans?.name ?? 'starter';
    const maxUnits = planName === 'enterprise' ? 9999 : planName === 'pro' ? 200 : 50;
    const maxResidents = planName === 'enterprise' ? 9999 : planName === 'pro' ? 400 : 100;

    let daysUntilBlocked: number | null = null;
    if (c.subscription_status === 'past_due' && c.past_due_since) {
      const daysPastDue = Math.floor(
        (Date.now() - new Date(c.past_due_since).getTime()) / 86_400_000,
      );
      daysUntilBlocked = Math.max(0, 30 - daysPastDue);
    }

    return {
      subscription_status: c.subscription_status,
      plan_name: planName,
      plan_price_monthly: c.plans?.price_monthly ?? null,
      trial_ends_at: c.trial_ends_at ?? null,
      past_due_since: c.past_due_since ?? null,
      days_until_blocked: daysUntilBlocked,
      stripe_customer_id: c.stripe_customer_id ?? null,
      usage: {
        units: unitsCount ?? 0,
        max_units: maxUnits,
        residents: residentsCount ?? 0,
        max_residents: maxResidents,
      },
    };
  }

  private async syncSubscription(sub: Record<string, unknown>): Promise<void> {
    const condoId = (sub['metadata'] as Record<string, string>)?.['condominium_id'];
    if (!condoId) return;

    const statusMap: Record<string, string> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      paused: 'paused',
    };

    const status = sub['status'] as string;
    await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .update({
        stripe_customer_id: sub['customer'] as string,
        stripe_subscription_id: sub['id'] as string,
        subscription_status: statusMap[status] ?? 'active',
        past_due_since: status === 'past_due' ? new Date().toISOString() : null,
      })
      .eq('id', condoId);
  }

  private async cancelSubscription(sub: Record<string, unknown>): Promise<void> {
    const condoId = (sub['metadata'] as Record<string, string>)?.['condominium_id'];
    if (!condoId) return;

    await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .update({ subscription_status: 'canceled' })
      .eq('id', condoId);
  }

  private async markPastDue(subscriptionId: string): Promise<void> {
    await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .update({ subscription_status: 'past_due', past_due_since: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId);
  }

  private async clearPastDue(subscriptionId: string): Promise<void> {
    await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .update({ subscription_status: 'active', past_due_since: null })
      .eq('stripe_subscription_id', subscriptionId);
  }
}
