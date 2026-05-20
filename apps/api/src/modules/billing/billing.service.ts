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

    const { data: plan } = await supabase
      .from('plans')
      .select('stripe_price_id, name')
      .eq('id', dto.plan_id)
      .single();

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
