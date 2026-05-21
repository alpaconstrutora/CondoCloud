import type { MessageAudience } from '../constants/enums';

export interface Message {
  id: string;
  title: string;
  content: string;
  audience: MessageAudience;
  target_id?: string;
  pinned: boolean;
  publish_at: string;
  created_by?: string;
  condominium_id: string;
  created_at: string;
  deleted_at?: string;
  profiles?: { name: string };
}

export interface MessageWithMeta extends Message {
  unread: boolean;
  read_count: number;
}

export interface MessagesPage {
  data: MessageWithMeta[];
  total: number;
  page: number;
  page_size: number;
}
