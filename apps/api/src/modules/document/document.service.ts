import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateDocumentDto } from './dto/document.dto';

interface Document {
  id: string;
  title: string;
  category: string;
  file_url: string;
  file_size_bytes?: number;
  version: number;
  parent_id?: string;
  visible_to: string;
  condominium_id: string;
  uploaded_by?: string;
  created_at: string;
}

@Injectable()
export class DocumentService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(condoId: string, uploadedBy: string, dto: CreateDocumentDto): Promise<Document> {
    let version = 1;

    if (dto.parent_id) {
      const { data: parent } = await this.supabaseService
        .getAdminClient()
        .from('documents')
        .select('version')
        .eq('id', dto.parent_id)
        .eq('condominium_id', condoId)
        .single();

      if (!parent) throw new NotFoundException('Documento pai não encontrado');
      version = ((parent as { version: number }).version ?? 0) + 1;
    }

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('documents')
      .insert({
        ...dto,
        version,
        condominium_id: condoId,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Document;
  }

  async findAll(condoId: string, category?: string): Promise<Document[]> {
    let query = this.supabaseService
      .getAdminClient()
      .from('documents')
      .select('*')
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);

    const { data } = await query;
    return (data ?? []) as Document[];
  }

  async delete(condoId: string, id: string): Promise<void> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('documents')
      .select('id')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!data) throw new NotFoundException('Documento não encontrado');

    await this.supabaseService.getAdminClient().from('documents').delete().eq('id', id);
  }
}
