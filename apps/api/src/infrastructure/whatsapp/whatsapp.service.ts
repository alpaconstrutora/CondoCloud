import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

const GRAPH_API_VERSION = 'v20.0';
const RATE_LIMIT_MS     = 30_000; // 30 s por número
const MAX_ATTEMPTS      = 3;

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly phoneNumberId: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly rateLimitMap = new Map<string, number>();

  constructor(
    config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.phoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    this.accessToken   = config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn('WhatsApp Cloud API não configurada — envio de mensagens desativado');
    }
  }

  async sendMessage(phone: string, text: string, profileId?: string): Promise<void> {
    if (!this.phoneNumberId || !this.accessToken) return;

    const number = phone.replace(/\D/g, '');
    if (!number) return;

    if (this.isRateLimited(number)) return;

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: number,
      type: 'text',
      text: { body: text },
    };

    let messageId: string | undefined;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

        const body = await res.json() as { messages?: { id: string }[] };
        messageId = body?.messages?.[0]?.id;
        this.rateLimitMap.set(number, Date.now());
        this.logger.debug(`WhatsApp enviado → ${number} (tentativa ${attempt})`);
        lastError = undefined;
        break;
      } catch (err) {
        lastError = String(err);
        if (attempt < MAX_ATTEMPTS) {
          const delay = 1_000 * Math.pow(2, attempt - 1);
          this.logger.warn(`WhatsApp falhou → ${number} (tentativa ${attempt}, retry em ${delay}ms): ${err}`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          this.logger.error(`WhatsApp falhou definitivamente → ${number}: ${err}`);
        }
      }
    }

    await this.supabase.getAdminClient().from('whatsapp_send_log').insert({
      profile_id: profileId ?? null,
      phone:      number,
      message_id: messageId ?? null,
      status:     lastError ? 'failed' : 'sent',
      error:      lastError ?? null,
    });
  }

  private isRateLimited(number: string): boolean {
    const lastSent = this.rateLimitMap.get(number) ?? 0;
    if (Date.now() - lastSent < RATE_LIMIT_MS) {
      this.logger.warn(`WhatsApp rate limited → ${number} (cooldown de ${RATE_LIMIT_MS / 1000}s ativo)`);
      return true;
    }
    return false;
  }
}
