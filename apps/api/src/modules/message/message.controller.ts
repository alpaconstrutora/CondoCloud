import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/message.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateMessageDto,
  ): Promise<ApiResponse> {
    const msg = await this.messageService.create(condoId, user.id, dto);
    return ApiResponse.ok(msg, 'Aviso publicado');
  }

  @Get()
  async findAll(
    @CurrentTenant() condoId: string,
    @Query('pinned') pinned?: string,
  ): Promise<ApiResponse> {
    const pinnedBool = pinned === 'true' ? true : pinned === 'false' ? false : undefined;
    const messages = await this.messageService.findAll(condoId, pinnedBool);
    return ApiResponse.ok(messages);
  }

  @Post(':id/read')
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: Profile,
  ): Promise<ApiResponse> {
    await this.messageService.markRead(id, user.id);
    return ApiResponse.ok(null, 'Lido');
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async delete(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.messageService.delete(condoId, id);
    return ApiResponse.ok(null, 'Aviso removido');
  }
}
