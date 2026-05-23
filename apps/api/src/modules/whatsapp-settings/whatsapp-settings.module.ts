import { Module } from '@nestjs/common';
import { WhatsappSettingsController } from './whatsapp-settings.controller';
import { WhatsappSettingsService } from './whatsapp-settings.service';

@Module({
  controllers: [WhatsappSettingsController],
  providers: [WhatsappSettingsService],
  exports: [WhatsappSettingsService],
})
export class WhatsappSettingsModule {}
