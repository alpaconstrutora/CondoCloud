import { Injectable, NotFoundException } from '@nestjs/common';
import { addHours, differenceInHours } from 'date-fns';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import { DOMAIN_EVENTS, TICKET_SLA_HOURS } from '@condocloud/shared';
import { CreateTicketDto, UpdateTicketDto, AddTicketUpdateDto } from './dto/ticket.dto';
import type { Ticket, TicketUpdate } from '@condocloud/shared';

@Injectable()
export class TicketService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async create(condoId: string, createdBy: string, dto: CreateTicketDto): Promise<Ticket> {
    const slaDeadline = addHours(new Date(), TICKET_SLA_HOURS[dto.priority]);

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('tickets')
      .insert({
        ...dto,
        condominium_id: condoId,
        created_by: createdBy,
        sla_deadline: slaDeadline.toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Ticket;
  }

  async findAll(condoId: string, status?: string): Promise<Ticket[]> {
    let query = this.supabaseService
      .getAdminClient()
      .from('tickets')
      .select('*, profiles!created_by(name), profiles!assigned_to(name)')
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data } = await query;
    return (data ?? []) as Ticket[];
  }

  async findOne(condoId: string, id: string): Promise<Ticket> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('tickets')
      .select('*, ticket_updates(*)')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!data) throw new NotFoundException('Chamado não encontrado');
    return data as Ticket;
  }

  private async findStatus(condoId: string, id: string): Promise<{ status: string; created_at: string; category: string }> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('tickets')
      .select('status, created_at, category')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!data) throw new NotFoundException('Chamado não encontrado');
    return data as { status: string; created_at: string; category: string };
  }

  async update(condoId: string, id: string, actorId: string, dto: UpdateTicketDto): Promise<Ticket> {
    const existing = await this.findStatus(condoId, id);

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('tickets')
      .update(dto)
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Registra histórico se mudou status
    if (dto.status && dto.status !== existing.status) {
      await this.supabaseService.getAdminClient().from('ticket_updates').insert({
        ticket_id: id,
        author_id: actorId,
        status_from: existing.status,
        status_to: dto.status,
        content: `Status alterado para ${dto.status}`,
        attachments: [],
      });

      if (dto.status === 'resolved') {
        const resolutionHours = differenceInHours(new Date(), new Date(existing.created_at));
        await this.eventEmitter.emit({
          event_name: DOMAIN_EVENTS.TICKET_RESOLVED,
          aggregate_id: id,
          aggregate_type: 'ticket',
          event_version: 1,
          source: 'api',
          condo_id: condoId,
          payload: { resolution_time_hours: resolutionHours, category: existing.category },
        });
      }
    }

    return data as Ticket;
  }

  async addUpdate(condoId: string, ticketId: string, authorId: string, dto: AddTicketUpdateDto): Promise<TicketUpdate> {
    const ticket = await this.findStatus(condoId, ticketId);

    const updatePayload: Record<string, unknown> = {
      ticket_id: ticketId,
      author_id: authorId,
      content: dto.content,
      attachments: dto.attachments ?? [],
    };

    if (dto.status_to && dto.status_to !== ticket.status) {
      updatePayload['status_from'] = ticket.status;
      updatePayload['status_to'] = dto.status_to;

      const { error: statusError } = await this.supabaseService
        .getAdminClient()
        .from('tickets')
        .update({ status: dto.status_to })
        .eq('id', ticketId);

      if (statusError) throw new Error(statusError.message);

      if (dto.status_to === 'resolved') {
        const resolutionHours = differenceInHours(new Date(), new Date(ticket.created_at));
        await this.eventEmitter.emit({
          event_name: DOMAIN_EVENTS.TICKET_RESOLVED,
          aggregate_id: ticketId,
          aggregate_type: 'ticket',
          event_version: 1,
          source: 'api',
          condo_id: condoId,
          payload: { resolution_time_hours: resolutionHours, category: ticket.category },
        });
      }
    }

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('ticket_updates')
      .insert(updatePayload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as TicketUpdate;
  }
}
