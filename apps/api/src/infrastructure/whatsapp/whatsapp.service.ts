import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly instance: string;

  constructor(config: ConfigService) {
    this.apiUrl = config.get<string>('EVOLUTION_API_URL');
    this.apiKey = config.get<string>('EVOLUTION_API_KEY');
    this.instance = config.get<string>('EVOLUTION_INSTANCE_NAME') ?? 'condocloud';
    if (!this.apiUrl || !this.apiKey) {
      this.logger.warn('Evolution API não configurada — envio de WhatsApp desativado');
    }
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    if (!this.apiUrl || !this.apiKey) return;
    const number = phone.replace(/\D/g, '');
    if (!number) return;
    try {
      const res = await fetch(`${this.apiUrl}/message/sendText/${this.instance}`, {
        method: 'POST',
        headers: { apikey: this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      this.logger.debug(`WhatsApp enviado → ${number}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar WhatsApp → ${number}: ${err}`);
    }
  }
}
