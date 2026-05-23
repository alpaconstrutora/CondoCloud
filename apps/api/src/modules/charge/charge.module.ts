import { Module } from '@nestjs/common';
import { ChargeService } from './charge.service';
import { ChargeController } from './charge.controller';
import { EventsModule } from '../../events/events.module';
import { WhatsAppModule } from '../../infrastructure/whatsapp/whatsapp.module';
import { WhatsappSettingsModule } from '../whatsapp-settings/whatsapp-settings.module';

@Module({
  imports: [EventsModule, WhatsAppModule, WhatsappSettingsModule],
  providers: [ChargeService],
  controllers: [ChargeController],
  exports: [ChargeService],
})
export class ChargeModule {}
