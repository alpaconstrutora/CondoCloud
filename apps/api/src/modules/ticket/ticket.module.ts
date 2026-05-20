import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [TicketService],
  controllers: [TicketController],
  exports: [TicketService],
})
export class TicketModule {}
