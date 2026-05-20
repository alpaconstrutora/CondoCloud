import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { UpdatePreferencesDto } from './dto/notification.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async findAll(
    @CurrentUser() user: Profile,
    @CurrentTenant() condoId: string,
  ): Promise<ApiResponse> {
    const notifications = await this.notificationService.findAll(user.id, condoId);
    return ApiResponse.ok(notifications);
  }

  @Get('unread-count')
  async unreadCount(
    @CurrentUser() user: Profile,
    @CurrentTenant() condoId: string,
  ): Promise<ApiResponse> {
    const count = await this.notificationService.getUnreadCount(user.id, condoId);
    return ApiResponse.ok({ count });
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: Profile,
  ): Promise<ApiResponse> {
    await this.notificationService.markRead(id, user.id);
    return ApiResponse.ok(null, 'Lida');
  }

  @Patch(':id/clicked')
  async markClicked(
    @Param('id') id: string,
    @CurrentUser() user: Profile,
  ): Promise<ApiResponse> {
    await this.notificationService.markClicked(id, user.id);
    return ApiResponse.ok(null, 'Click registrado');
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: Profile): Promise<ApiResponse> {
    const prefs = await this.notificationService.getPreferences(user.id);
    return ApiResponse.ok(prefs);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: Profile,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<ApiResponse> {
    const prefs = await this.notificationService.updatePreferences(user.id, dto);
    return ApiResponse.ok(prefs, 'Preferências atualizadas');
  }
}
