import type { ReservationStatus } from '../constants/enums';

export interface CommonArea {
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

export interface Reservation {
  id: string;
  common_area_id: string;
  common_area?: CommonArea;
  profile_id: string;
  unit_id?: string;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  notes?: string;
  approved_by?: string;
  condominium_id: string;
  created_at: string;
}

// DTOs
export interface CreateReservationDto {
  common_area_id: string;
  starts_at: string;
  ends_at: string;
  notes?: string;
}

export interface CreateCommonAreaDto {
  name: string;
  description?: string;
  capacity?: number;
  requires_approval?: boolean;
  min_advance_hours?: number;
  max_duration_hours?: number;
  fee?: number;
  rules?: string;
}
