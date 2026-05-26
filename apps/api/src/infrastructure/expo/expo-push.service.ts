import { Injectable, Logger } from '@nestjs/common';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data: ExpoTicket[];
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Serviço para envio de push notifications via Expo Push API.
 * Documentação: https://docs.expo.dev/push-notifications/sending-notifications/
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  /**
   * Envia push notification para um ou mais tokens Expo.
   * Silencia erros — push é best-effort (token pode ter expirado, app desinstalado, etc.).
   */
  async send(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) return;

    // Filtra tokens inválidos (deve começar com ExponentPushToken[ ou ExpoPushToken[)
    const valid = messages.filter(m =>
      typeof m.to === 'string' &&
      (m.to.startsWith('ExponentPushToken[') || m.to.startsWith('ExpoPushToken[')),
    );

    if (valid.length === 0) return;

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(valid),
      });

      if (!res.ok) {
        this.logger.warn(`[ExpoPush] HTTP ${res.status}`);
        return;
      }

      const body = await res.json() as ExpoResponse;
      const errors = body.data.filter(t => t.status === 'error');
      if (errors.length > 0) {
        errors.forEach(e => this.logger.warn(`[ExpoPush] Ticket error: ${e.message} (${e.details?.error})`));
      }
    } catch (err) {
      this.logger.error('[ExpoPush] Falha ao enviar push', err);
    }
  }

  /**
   * Envia notificação para um único token, silenciando erros.
   */
  async sendOne(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    await this.send([{
      to: token,
      title,
      body,
      sound: 'default',
      channelId: 'default',
      data,
    }]);
  }
}
