import { Module } from '@nestjs/common';
import { ChargeService } from './charge.service';
import { ChargeController } from './charge.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [ChargeService],
  controllers: [ChargeController],
  exports: [ChargeService],
})
export class ChargeModule {}
