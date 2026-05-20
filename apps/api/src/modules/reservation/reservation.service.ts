import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateCommonAreaDto, CreateReservationDto } from './dto/reservation.dto';

interface CommonArea {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  requires_approval: boolean;
  min_advance_hours: number;
  max_duration_hours: number;
  fee: number;
  rules?: string;
  active: boolean;
  condominium_id: string;
  created_at: string;
}

interface Reservation {
  id: string;
  common_area_id: string;
  profile_id: string;
  unit_id?: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string;
  approved_by?: string;
  condominium_id: string;
  created_at: string;
}

@Injectable()
export class ReservationService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createArea(condoId: string, dto: CreateCommonAreaDto): Promise<CommonArea> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('common_areas')
      .insert({ ...dto, condominium_id: condoId })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as CommonArea;
  }

  async listAreas(condoId: string): Promise<CommonArea[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('common_areas')
      .select('*')
      .eq('condominium_id', condoId)
      .eq('active', true)
      .order('name');

    return (data ?? []) as CommonArea[];
  }

  async create(condoId: string, profileId: string, dto: CreateReservationDto): Promise<Reservation> {
    const startsAt = new Date(dto.starts_at);
    const endsAt = new Date(dto.ends_at);

    if (endsAt <= startsAt) {
      throw new BadRequestException('ends_at deve ser posterior a starts_at');
    }

    // Validar área e regras
    const { data: area } = await this.supabaseService
      .getAdminClient()
      .from('common_areas')
      .select('*')
      .eq('id', dto.common_area_id)
      .eq('condominium_id', condoId)
      .single();

    if (!area) throw new NotFoundException('Área comum não encontrada');

    const areaData = area as CommonArea;
    const hoursInAdvance = (startsAt.getTime() - Date.now()) / 3_600_000;
    if (hoursInAdvance < areaData.min_advance_hours) {
      throw new BadRequestException(
        `Reserva deve ser feita com pelo menos ${areaData.min_advance_hours}h de antecedência`,
      );
    }

    const durationHours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
    if (durationHours > areaData.max_duration_hours) {
      throw new BadRequestException(`Duração máxima: ${areaData.max_duration_hours}h`);
    }

    // Verificar conflito de horário
    const { data: conflicts } = await this.supabaseService
      .getAdminClient()
      .from('reservations')
      .select('id')
      .eq('common_area_id', dto.common_area_id)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', dto.ends_at)
      .gt('ends_at', dto.starts_at);

    if (conflicts?.length) {
      throw new BadRequestException('Horário já reservado para esta área');
    }

    const status = areaData.requires_approval ? 'pending' : 'confirmed';

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('reservations')
      .insert({
        common_area_id: dto.common_area_id,
        profile_id: profileId,
        unit_id: dto.unit_id,
        starts_at: dto.starts_at,
        ends_at: dto.ends_at,
        notes: dto.notes,
        status,
        condominium_id: condoId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Reservation;
  }

  async listByProfile(condoId: string, profileId: string): Promise<Reservation[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('reservations')
      .select('*, common_areas(name)')
      .eq('condominium_id', condoId)
      .eq('profile_id', profileId)
      .order('starts_at', { ascending: false });

    return (data ?? []) as Reservation[];
  }

  async listAll(condoId: string): Promise<Reservation[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('reservations')
      .select('*, common_areas(name), profiles!profile_id(name)')
      .eq('condominium_id', condoId)
      .order('starts_at', { ascending: false });

    return (data ?? []) as Reservation[];
  }

  async approve(condoId: string, id: string, approvedBy: string): Promise<Reservation> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('reservations')
      .update({ status: 'confirmed', approved_by: approvedBy })
      .eq('id', id)
      .eq('condominium_id', condoId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Reserva não encontrada ou já processada');
    return data as Reservation;
  }

  async cancel(condoId: string, id: string, profileId: string): Promise<void> {
    const { data: existing } = await this.supabaseService
      .getAdminClient()
      .from('reservations')
      .select('profile_id, status')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!existing) throw new NotFoundException('Reserva não encontrada');

    const row = existing as { profile_id: string; status: string };
    if (row.profile_id !== profileId) {
      throw new BadRequestException('Apenas o solicitante pode cancelar a reserva');
    }
    if (row.status === 'cancelled') {
      throw new BadRequestException('Reserva já cancelada');
    }

    await this.supabaseService
      .getAdminClient()
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id);
  }
}
