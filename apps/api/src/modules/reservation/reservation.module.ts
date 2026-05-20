import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CommonAreaController, ReservationController } from './reservation.controller';

@Module({
  providers: [ReservationService],
  controllers: [CommonAreaController, ReservationController],
  exports: [ReservationService],
})
export class ReservationModule {}
