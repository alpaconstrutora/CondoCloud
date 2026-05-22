import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { SupabaseService } from '../supabase/supabase.service';

// Status enviados pela Meta já chegam em lowercase
const VALID_STATUSES = new Set(['sent', 'delivered', 'read', 'failed']);

interface MetaStatusEntry {
  id: string;           // wamid do message
  status: string;       // sent | delivered | read | failed
  timestamp: string;
  recipient_id: string;
}

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    changes: Array<{
      value: {
        statuses?: MetaStatusEntry[];
      };
    }>;
  }>;
}

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.verifyToken = config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ?? '';
  }

  // Verificação de endpoint exigida pela Meta ao cadastrar o webhook
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (mode === 'subscribe' && token === this.verifyToken) return challenge;
    throw new ForbiddenException('Verify token inválido');
  }

  // Recebe eventos de status (sent, delivered, read, failed)
  @Public()
  @Post()
  @HttpCode(200)
  async handleEvent(@Body() payload: MetaWebhookPayload): Promise<{ ok: boolean }> {
    if (payload.object !== 'whatsapp_business_account') return { ok: true };

    const statuses: MetaStatusEntry[] = payload.entry
      ?.flatMap(e => e.changes)
      ?.flatMap(c => c.value?.statuses ?? []) ?? [];

    for (const entry of statuses) {
      if (!entry.id || !VALID_STATUSES.has(entry.status)) continue;

      const { error } = await this.supabase
        .getAdminClient()
        .from('whatsapp_send_log')
        .update({ status: entry.status, updated_at: new Date().toISOString() })
        .eq('message_id', entry.id);

      if (error) {
        this.logger.error(`Erro ao atualizar status ${entry.id}: ${error.message}`);
      } else {
        this.logger.debug(`Status atualizado: ${entry.id} → ${entry.status}`);
      }
    }

    return { ok: true };
  }
}
