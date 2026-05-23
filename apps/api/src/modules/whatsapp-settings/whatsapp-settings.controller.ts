import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { ToggleEventDto, UpdateProfileWaDto } from './dto/whatsapp-settings.dto';

@Controller('whatsapp-settings')
@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
export class WhatsappSettingsController {
  constructor(private readonly service: WhatsappSettingsService) {}

  @Get()
  async getSettings(@CurrentTenant() condoId: string) {
    return { data: await this.service.getSettings(condoId) };
  }

  @Patch('events')
  async toggleEvent(@CurrentTenant() condoId: string, @Body() dto: ToggleEventDto) {
    const disabled_events = await this.service.toggleEvent(condoId, dto.event, dto.enabled);
    return { data: { disabled_events } };
  }

  @Patch('profiles/:id')
  async updateProfile(
    @CurrentTenant() condoId: string,
    @Param('id') profileId: string,
    @Body() dto: UpdateProfileWaDto,
  ) {
    await this.service.updateProfile(condoId, profileId, dto);
    return { data: { ok: true } };
  }
}
