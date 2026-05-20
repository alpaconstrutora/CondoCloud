import { Module } from '@nestjs/common';
import { DecisionEngineService } from './decision-engine.service';
import { EventEmitterService } from './event-emitter.service';

@Module({
  providers: [DecisionEngineService, EventEmitterService],
  exports: [DecisionEngineService, EventEmitterService],
})
export class EventsModule {}
