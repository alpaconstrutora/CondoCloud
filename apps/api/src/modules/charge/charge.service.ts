import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import { DOMAIN_EVENTS } from '@condocloud/shared';
import { CreateChargeDto, MarkPaidDto } from './dto/charge.dto';

interface Charge {
  id: string;
  unit_id: string;
  profile_id?: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at?: string;
  payment_method?: string;
  gateway_charge_id?: string;
  boleto_url?: string;
  pix_qr_code?: string;
  condominium_id: string;
  created_at: string;
}

@Injectable()
export class ChargeService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async create(condoId: string, dto: CreateChargeDto): Promise<Charge> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .insert({ ...dto, condominium_id: condoId })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const charge = data as Charge;
    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.CHARGE_CREATED,
      aggregate_id: charge.id,
      aggregate_type: 'charge',
      event_version: 1,
      source: 'api',
      condo_id: condoId,
      payload: {
        profile_id: charge.profile_id,
        amount: charge.amount,
        due_date: charge.due_date,
        description: charge.description,
      },
    });

    return charge;
  }

  async findAll(condoId: string, status?: string, competencia?: string): Promise<Charge[]> {
    let query = this.supabaseService
      .getAdminClient()
      .from('charges')
      .select('*, units(number, blocks(name)), profiles!profile_id(name, unit_profiles(units(number, blocks(name))))')
      .eq('condominium_id', condoId)
      .order('due_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    } else {
      // Por padrão excluir canceladas — só aparecem quando filtro explícito
      query = query.neq('status', 'cancelled');
    }

    if (competencia) {
      // competencia vem como "YYYY-MM", converter para "YYYY-MM-01"
      query = query.eq('competencia', `${competencia}-01`);
    }

    const { data } = await query;
    return (data ?? []) as Charge[];
  }

  async findByUnit(condoId: string, unitId: string): Promise<Charge[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .select('*')
      .eq('condominium_id', condoId)
      .eq('unit_id', unitId)
      .order('due_date', { ascending: false });

    return (data ?? []) as Charge[];
  }

  async markPaid(condoId: string, id: string, dto: MarkPaidDto): Promise<Charge> {
    const { data: existing } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .select('id')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!existing) throw new NotFoundException('Cobrança não encontrada');

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: dto.payment_method,
        gateway_charge_id: dto.gateway_charge_id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Charge;
  }

  async unmarkPaid(condoId: string, id: string): Promise<Charge> {
    const { data: existing } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .select('id, status, due_date')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!existing) throw new NotFoundException('Cobrança não encontrada');

    const today = new Date().toISOString().split('T')[0];
    const isOverdue = (existing as { due_date: string }).due_date < today;

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .update({ status: isOverdue ? 'overdue' : 'pending', paid_at: null, payment_method: null, gateway_charge_id: null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Charge;
  }

  async cancel(condoId: string, id: string): Promise<void> {
    const { data: existing } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .select('id, status')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!existing) throw new NotFoundException('Cobrança não encontrada');

    await this.supabaseService
      .getAdminClient()
      .from('charges')
      .update({ status: 'cancelled' })
      .eq('id', id);
  }

  async cancelByCompetencia(condoId: string, competencia: string): Promise<number> {
    const start = `${competencia}-01`;
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .update({ status: 'cancelled' })
      .eq('condominium_id', condoId)
      .eq('competencia', start)
      .neq('status', 'paid')
      .select('id');

    return (data ?? []).length;
  }

  async markOverdue(condoId: string): Promise<number> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('charges')
      .update({ status: 'overdue' })
      .eq('condominium_id', condoId)
      .eq('status', 'pending')
      .lt('due_date', new Date().toISOString().split('T')[0])
      .select('id');

    return (data ?? []).length;
  }
}
