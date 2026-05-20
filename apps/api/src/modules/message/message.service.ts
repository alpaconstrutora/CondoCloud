import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateMessageDto } from './dto/message.dto';

interface Message {
  id: string;
  title: string;
  content: string;
  audience: string;
  target_id?: string;
  pinned: boolean;
  publish_at: string;
  created_by?: string;
  condominium_id: string;
  created_at: string;
}

@Injectable()
export class MessageService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(condoId: string, createdBy: string, dto: CreateMessageDto): Promise<Message> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('messages')
      .insert({
        ...dto,
        condominium_id: condoId,
        created_by: createdBy,
        publish_at: dto.publish_at ?? new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Message;
  }

  async findAll(condoId: string, pinned?: boolean): Promise<Message[]> {
    let query = this.supabaseService
      .getAdminClient()
      .from('messages')
      .select('*, profiles!created_by(name)')
      .eq('condominium_id', condoId)
      .lte('publish_at', new Date().toISOString())
      .order('pinned', { ascending: false })
      .order('publish_at', { ascending: false });

    if (pinned !== undefined) query = query.eq('pinned', pinned);

    const { data } = await query;
    return (data ?? []) as Message[];
  }

  async markRead(messageId: string, profileId: string): Promise<void> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .single();

    if (!data) throw new NotFoundException('Aviso não encontrado');

    // Upsert — idempotent, unique PK (message_id, profile_id)
    await this.supabaseService.getAdminClient().from('message_reads').upsert({
      message_id: messageId,
      profile_id: profileId,
      read_at: new Date().toISOString(),
    });
  }

  async delete(condoId: string, id: string): Promise<void> {
    await this.supabaseService
      .getAdminClient()
      .from('messages')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);
  }
}
