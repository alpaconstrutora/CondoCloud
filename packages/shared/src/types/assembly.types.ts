import type { AssemblyStatus, VoteOption } from '../constants/enums';

export interface Assembly {
  id: string;
  title: string;
  description?: string;
  date: string;
  location?: string;
  status: AssemblyStatus;
  quorum_required: number;
  minutes_url?: string;
  condominium_id: string;
  created_by?: string;
  created_at: string;
  items?: AssemblyItem[];
}

export interface AssemblyItem {
  id: string;
  assembly_id: string;
  title: string;
  description?: string;
  order_index: number;
  result?: string;
  created_at: string;
  votes?: Vote[];
}

export interface Vote {
  id: string;
  assembly_item_id: string;
  profile_id: string;
  vote: VoteOption;
  created_at: string;
}

export interface VoteSummary {
  yes: number;
  no: number;
  abstain: number;
  total: number;
  quorum_reached: boolean;
}

// DTOs
export interface CreateAssemblyDto {
  title: string;
  description?: string;
  date: string;
  location?: string;
  quorum_required?: number;
  items?: { title: string; description?: string }[];
}

export interface CastVoteDto {
  vote: VoteOption;
}
