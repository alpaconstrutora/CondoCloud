import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateDocumentDto, GetUploadUrlDto } from './dto/document.dto';
import type { Document, DocumentUploadUrl, DocumentsPage } from '@condocloud/shared';
import type { UserRole } from '@condocloud/shared';
import { randomUUID } from 'crypto';

const BUCKET = 'documents';
const DEFAULT_PAGE_SIZE = 20;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class DocumentService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getUploadUrl(condoId: string, dto: GetUploadUrlDto): Promise<DocumentUploadUrl> {
    if (!ALLOWED_MIME_TYPES.has(dto.content_type)) {
      throw new BadRequestException(`Tipo de arquivo não permitido: ${dto.content_type}`);
    }

    const ext = dto.filename.includes('.') ? dto.filename.split('.').pop() : 'bin';
    const storage_path = `${condoId}/${randomUUID()}.${ext}`;

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .storage
      .from(BUCKET)
      .createSignedUploadUrl(storage_path);

    if (error || !data) throw new Error(error?.message ?? 'Erro ao gerar URL de upload');

    return { upload_url: data.signedUrl, storage_path };
  }

  async create(condoId: string, uploadedBy: string, dto: CreateDocumentDto): Promise<Document> {
    let version = 1;

    if (dto.parent_id) {
      const { data: parent } = await this.supabaseService
        .getAdminClient()
        .from('documents')
        .select('version')
        .eq('id', dto.parent_id)
        .eq('condominium_id', condoId)
        .is('deleted_at', null)
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

    await this.addAuditLog(data.id, 'created', uploadedBy);
    return data as Document;
  }

  async findAll(
    condoId: string,
    userRole: UserRole,
    category?: string,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<DocumentsPage> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabaseService
      .getAdminClient()
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('condominium_id', condoId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (category) query = query.eq('category', category);

    // Moradores não veem documentos restritos
    const isResident = userRole === 'morador' || userRole === 'prestador';
    if (isResident) query = query.eq('visible_to', 'all');

    const { data, count } = await query;
    return {
      data: (data ?? []) as Document[],
      total: count ?? 0,
      page,
      page_size: pageSize,
    };
  }

  async getDownloadUrl(condoId: string, id: string, userRole: UserRole, userId: string): Promise<string> {
    const { data: doc } = await this.supabaseService
      .getAdminClient()
      .from('documents')
      .select('id, storage_path, file_url, visible_to')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .is('deleted_at', null)
      .single();

    if (!doc) throw new NotFoundException('Documento não encontrado');

    const isResident = userRole === 'morador' || userRole === 'prestador';
    if (isResident && (doc as any).visible_to !== 'all') {
      throw new ForbiddenException('Sem permissão para acessar este documento');
    }

    await this.addAuditLog(id, 'downloaded', userId);

    // Se o arquivo está no Storage, gerar signed URL
    const storagePath = (doc as any).storage_path as string | null;
    if (storagePath) {
      const { data, error } = await this.supabaseService
        .getAdminClient()
        .storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 300); // 5 minutos

      if (error || !data) throw new Error('Erro ao gerar link de download');
      return data.signedUrl;
    }

    // Fallback: URL legada armazenada diretamente
    return (doc as any).file_url as string;
  }

  async getVersions(condoId: string, id: string): Promise<Document[]> {
    // Busca raiz: sobe até o documento sem parent_id
    const { data: root } = await this.supabaseService
      .getAdminClient()
      .from('documents')
      .select('id, parent_id')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!root) throw new NotFoundException('Documento não encontrado');

    let rootId = id;
    if ((root as any).parent_id) {
      rootId = (root as any).parent_id as string;
    }

    // Coleta todas as versões com mesmo ancestral
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('documents')
      .select('*')
      .eq('condominium_id', condoId)
      .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
      .is('deleted_at', null)
      .order('version', { ascending: true });

    return (data ?? []) as Document[];
  }

  async delete(condoId: string, id: string, userId: string): Promise<void> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('documents')
      .select('id, storage_path')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .is('deleted_at', null)
      .single();

    if (!data) throw new NotFoundException('Documento não encontrado');

    // Soft delete
    await this.supabaseService
      .getAdminClient()
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    await this.addAuditLog(id, 'deleted', userId);
  }

  private async addAuditLog(
    documentId: string,
    action: 'created' | 'downloaded' | 'deleted',
    userId: string,
  ): Promise<void> {
    await this.supabaseService
      .getAdminClient()
      .from('document_audit_log')
      .insert({ document_id: documentId, action, performed_by: userId });
  }
}
