import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto, MessageQueryDto } from './dto/message.dto';
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
    @CurrentUser() user: Profile,
    @Query() query: MessageQueryDto,
  ): Promise<ApiResponse> {
    const pinned = query.pinned === 'true' ? true : query.pinned === 'false' ? false : undefined;
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    const result = await this.messageService.findAll(
      condoId,
      user.id,
      user.role,
      (user as any).block_id ?? null,
      (user as any).unit_id ?? null,
      pinned,
      page,
      pageSize,
    );
    return ApiResponse.ok(result);
  }

  /** Lista quem leu um comunicado (síndico apenas) */
  @Get(':id/reads')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async getReads(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const reads = await this.messageService.getReads(condoId, id);
    return ApiResponse.ok(reads);
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
    @CurrentUser() user: Profile,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.messageService.delete(condoId, id, user.id);
    return ApiResponse.ok(null, 'Aviso removido');
  }
}
