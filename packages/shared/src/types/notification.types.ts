import type { NotificationType, NotificationChannel } from '../constants/enums';

export interface Notification {
  id: string;
  profile_id: string;
  title: string;
  body?: string;
  type: NotificationType;
  entity_id?: string;
  channel: NotificationChannel;
  read_at?: string;
  clicked_at?: string;
  sent_at?: string;
  condominium_id?: string;
  created_at: string;
}

export interface NotificationPreferences {
  profile_id: string;
  consecutive_ignored: number;
  cooldown_until?: string;
  last_opened_at?: string;
  silenced_types: NotificationType[];
  updated_at: string;
}

export interface Proposal {
  id: string;
  condominium_id: string;
  plan_id?: string;
  created_by?: string;
  token: string;
  pdf_url?: string;
  trial_snapshot?: Record<string, unknown>;
  expires_at: string;
  converted_at?: string;
  created_at: string;
}

export interface ProposalInteraction {
  id: string;
  proposal_id: string;
  viewer_name?: string;
  viewer_email?: string;
  action: 'viewed' | 'approved' | 'questioned';
  comment?: string;
  time_on_page_seconds?: number;
  visit_count: number;
  created_at: string;
}
