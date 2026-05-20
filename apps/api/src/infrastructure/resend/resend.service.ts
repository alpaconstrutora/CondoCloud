import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private client: Resend | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM') ?? 'noreply@condocloud.app';
    if (apiKey) {
      this.client = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY não configurada — envio de e-mails desativado');
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.emails.send({ from: this.from, to, subject, html });
      this.logger.debug(`E-mail enviado → ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail → ${to}: ${err}`);
    }
  }
}
