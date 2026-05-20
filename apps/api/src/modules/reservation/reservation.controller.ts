import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateCommonAreaDto, CreateReservationDto } from './dto/reservation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('common-areas')
export class CommonAreaController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @Body() dto: CreateCommonAreaDto,
  ): Promise<ApiResponse> {
    const area = await this.reservationService.createArea(condoId, dto);
    return ApiResponse.ok(area, 'Área comum criada');
  }

  @Get()
  async list(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const areas = await this.reservationService.listAreas(condoId);
    return ApiResponse.ok(areas);
  }
}

@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateReservationDto,
  ): Promise<ApiResponse> {
    const reservation = await this.reservationService.create(condoId, user.id, dto);
    return ApiResponse.ok(reservation, 'Reserva solicitada');
  }

  @Get()
  async list(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
  ): Promise<ApiResponse> {
    const reservations = await this.reservationService.listByProfile(condoId, user.id);
    return ApiResponse.ok(reservations);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async listAll(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const reservations = await this.reservationService.listAll(condoId);
    return ApiResponse.ok(reservations);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async approve(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const reservation = await this.reservationService.approve(condoId, id, user.id);
    return ApiResponse.ok(reservation, 'Reserva aprovada');
  }

  @Patch(':id/cancel')
  async cancel(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.reservationService.cancel(condoId, id, user.id);
    return ApiResponse.ok(null, 'Reserva cancelada');
  }
}
