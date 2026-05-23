import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { EventsModule } from '../../events/events.module';
import { WhatsAppModule } from '../../infrastructure/whatsapp/whatsapp.module';
import { WhatsappSettingsModule } from '../whatsapp-settings/whatsapp-settings.module';

@Module({
  imports: [EventsModule, WhatsAppModule, WhatsappSettingsModule],
  providers: [TicketService],
  controllers: [TicketController],
  exports: [TicketService],
})
export class TicketModule {}
