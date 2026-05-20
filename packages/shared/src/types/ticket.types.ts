import type { TicketStatus, TicketPriority, TicketCategory } from '../constants/enums';

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  sla_deadline?: string;
  rating?: number;
  created_by?: string;
  assigned_to?: string;
  condominium_id: string;
  unit_id?: string;
  ai_classification?: AiClassification;
  created_at: string;
  updated_at: string;
}

export interface AiClassification {
  category: TicketCategory;
  priority: TicketPriority;
  confidence: number;
  reasoning?: string;
}

export interface TicketUpdate {
  id: string;
  ticket_id: string;
  author_id?: string;
  content?: string;
  status_from?: TicketStatus;
  status_to?: TicketStatus;
  attachments: string[];
  created_at: string;
}

// DTOs de request
export interface CreateTicketDto {
  title: string;
  description?: string;
  priority: TicketPriority;
  category: TicketCategory;
  unit_id?: string;
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: string;
  rating?: number;
}

export interface AddTicketUpdateDto {
  content: string;
  status_to?: TicketStatus;
  attachments?: string[];
}
