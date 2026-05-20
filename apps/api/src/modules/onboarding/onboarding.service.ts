import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import { DOMAIN_EVENTS } from '@condocloud/shared';
import { Step1Dto, Step2Dto, Step4Dto } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async getStatus(condoId: string): Promise<{ step: number; completed: boolean }> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('onboarding_step, onboarding_completed')
      .eq('id', condoId)
      .single();

    return {
      step: (data as { onboarding_step: number } | null)?.onboarding_step ?? 1,
      completed: (data as { onboarding_completed: boolean } | null)?.onboarding_completed ?? false,
    };
  }

  // Passo 1: Dados do condomínio
  async completeStep1(condoId: string, dto: Step1Dto): Promise<void> {
    await this.supabaseService.getAdminClient()
      .from('condominiums')
      .update({ name: dto.name, address: dto.address, cnpj: dto.cnpj, onboarding_step: 2 })
      .eq('id', condoId);
  }

  // Passo 2: Estrutura física (geração automática)
  async completeStep2(condoId: string, dto: Step2Dto): Promise<{ blocks_created: number; units_created: number }> {
    this.logger.log(`Step2 condoId=${condoId} mode=${dto.mode}`);
    const supabase = this.supabaseService.getAdminClient();
    let blocksCreated = 0;
    let unitsCreated = 0;

    if (dto.mode === 'quick') {
      const totalUnits = dto.total_units ?? 20;
      const { data: block, error: blockErr } = await supabase
        .from('blocks')
        .insert({ name: 'Bloco A', condominium_id: condoId })
        .select()
        .single();

      if (blockErr || !block) {
        this.logger.error('Block insert failed', blockErr);
        throw new Error(blockErr?.message ?? 'Falha ao criar bloco');
      }

      blocksCreated = 1;
      const units = Array.from({ length: totalUnits }, (_, i) => {
        const floor = Math.ceil((i + 1) / 4);
        const num = `${floor}${String((i % 4) + 1).padStart(2, '0')}`;
        return { number: num, block_id: (block as { id: string }).id, condominium_id: condoId };
      });
      await supabase.from('units').insert(units);
      unitsCreated = totalUnits;
    } else {
      const blocks = dto.blocks ?? [{ name: 'Bloco A', units_count: 20 }];
      for (const blockConfig of blocks) {
        const { data: block } = await supabase
          .from('blocks')
          .insert({ name: blockConfig.name, condominium_id: condoId })
          .select()
          .single();

        blocksCreated++;
        const units = Array.from({ length: blockConfig.units_count }, (_, i) => {
          const floor = Math.ceil((i + 1) / 4);
          const num = `${floor}${String((i % 4) + 1).padStart(2, '0')}`;
          return { number: num, block_id: (block as { id: string }).id, condominium_id: condoId };
        });
        await supabase.from('units').insert(units);
        unitsCreated += blockConfig.units_count;
      }
    }

    await supabase.from('condominiums').update({ onboarding_step: 3 }).eq('id', condoId);
    return { blocks_created: blocksCreated, units_created: unitsCreated };
  }

  // Passo 3: Gera link de convite para WhatsApp
  async generateInviteLink(
    condoId: string,
    createdBy: string,
  ): Promise<{ invite_url: string; whatsapp_message: string }> {
    const token = uuidv4().replace(/-/g, '');

    await this.supabaseService.getAdminClient().from('invites').insert({
      token,
      condominium_id: condoId,
      created_by: createdBy,
      channel: 'whatsapp',
      role: 'morador',
    });

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.INVITE_SENT,
      aggregate_id: token,
      aggregate_type: 'invite',
      event_version: 1,
      source: 'api',
      condo_id: condoId,
      payload: { channel: 'whatsapp', invite_id: token },
    });

    const { data: condo } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('name')
      .eq('id', condoId)
      .single();

    const condoName = (condo as { name: string } | null)?.name ?? 'nosso condomínio';
    const appUrl = process.env.WEB_URL ?? 'http://localhost:5173';
    const inviteUrl = `${appUrl}/convite/${token}`;

    const whatsappMessage =
      `Olá vizinhos! 🏢 Estamos usando o CondoCloud para o ${condoName}.\n` +
      `✅ Ver avisos sem se perder no grupo\n` +
      `✅ Abrir chamados e acompanhar\n` +
      `✅ Votar em decisões\n` +
      `Acesse: ${inviteUrl} (1 minuto)`;

    await this.supabaseService.getAdminClient()
      .from('condominiums')
      .update({ onboarding_step: 4 })
      .eq('id', condoId);

    return { invite_url: inviteUrl, whatsapp_message: whatsappMessage };
  }

  // Passo 4: Configurações (opcionais)
  async completeStep4(condoId: string, dto: Step4Dto): Promise<void> {
    const settings: Record<string, unknown> = {};
    if (dto.sla_manutencao_hours) settings['sla_manutencao_hours'] = dto.sla_manutencao_hours;
    if (dto.sla_urgente_hours) settings['sla_urgente_hours'] = dto.sla_urgente_hours;
    if (dto.taxa_condominial) settings['taxa_condominial'] = dto.taxa_condominial;

    await this.supabaseService.getAdminClient()
      .from('condominiums')
      .update({ settings, onboarding_step: 5 })
      .eq('id', condoId);
  }

  // Passo 5: Dados de demonstração + marcar onboarding concluído
  async completeStep5(condoId: string, createdBy: string): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    // Aviso de boas-vindas
    await supabase.from('messages').insert({
      title: 'Bem-vindo ao CondoCloud! 🎉',
      content: 'Este é o mural do condomínio. Aqui você publica avisos, convoca assembleias e se comunica com todos os moradores sem o caos do WhatsApp.',
      audience: 'all',
      pinned: true,
      created_by: createdBy,
      condominium_id: condoId,
    });

    // Ticket de exemplo já resolvido (mostra o valor do produto)
    await supabase.from('tickets').insert({
      title: '[Demonstração] Lâmpada queimada no corredor',
      description: 'Exemplo de chamado resolvido via CondoCloud.',
      status: 'resolved',
      priority: 'low',
      category: 'manutencao',
      created_by: createdBy,
      condominium_id: condoId,
    });

    await supabase
      .from('condominiums')
      .update({ onboarding_completed: true, onboarding_step: 5 })
      .eq('id', condoId);
  }
}
