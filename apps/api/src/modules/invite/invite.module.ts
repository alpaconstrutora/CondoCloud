import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [InviteService],
  controllers: [InviteController],
  exports: [InviteService],
})
export class InviteModule {}
