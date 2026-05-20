import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { CondominiumController } from './condominium.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [OnboardingService],
  controllers: [OnboardingController, CondominiumController],
})
export class OnboardingModule {}
