import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { CreateTicketDto, UpdateTicketDto, AddTicketUpdateDto } from './dto/ticket.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateTicketDto,
  ): Promise<ApiResponse> {
    const ticket = await this.ticketService.create(condoId, user.id, dto);
    return ApiResponse.ok(ticket, 'Chamado aberto');
  }

  @Get()
  async findAll(
    @CurrentTenant() condoId: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse> {
    const tickets = await this.ticketService.findAll(condoId, status);
    return ApiResponse.ok(tickets);
  }

  @Get(':id')
  async findOne(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const ticket = await this.ticketService.findOne(condoId, id);
    return ApiResponse.ok(ticket);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async update(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<ApiResponse> {
    const ticket = await this.ticketService.update(condoId, id, user.id, dto);
    return ApiResponse.ok(ticket);
  }

  @Post(':id/updates')
  async addUpdate(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Param('id') id: string,
    @Body() dto: AddTicketUpdateDto,
  ): Promise<ApiResponse> {
    const update = await this.ticketService.addUpdate(condoId, id, user.id, dto);
    return ApiResponse.ok(update, 'Atualização adicionada');
  }
}
