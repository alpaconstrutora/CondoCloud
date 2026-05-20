import type { UserRole } from '../constants/enums';

// Re-exportar Profile do condominium.types para conveniência
export type { Profile, Invite } from './condominium.types';

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  avatar_url?: string;
  whatsapp?: string;
  push_token?: string;
}

export interface CreateInviteDto {
  email?: string;
  unit_id?: string;
  role?: 'morador' | 'prestador';
  channel: 'whatsapp' | 'email' | 'qr' | 'csv';
}

export interface ResolveInviteDto {
  token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  condominium_id: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: 'sindico'; // apenas síndico se registra diretamente
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}
