import { Module } from '@nestjs/common';
import { ProposalService } from './proposal.service';
import { ProposalController } from './proposal.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [ProposalService],
  controllers: [ProposalController],
  exports: [ProposalService],
})
export class ProposalModule {}
