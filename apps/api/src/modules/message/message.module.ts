import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { EventsModule } from '../../events/events.module';
import { WhatsAppModule } from '../../infrastructure/whatsapp/whatsapp.module';
import { WhatsappSettingsModule } from '../whatsapp-settings/whatsapp-settings.module';

@Module({
  imports: [EventsModule, WhatsAppModule, WhatsappSettingsModule],
  providers: [MessageService],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}
