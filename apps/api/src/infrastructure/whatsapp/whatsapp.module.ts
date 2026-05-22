import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [ConfigModule],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
