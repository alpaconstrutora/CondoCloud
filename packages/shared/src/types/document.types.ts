import type { DocumentCategory, DocumentVisibility } from '../constants/enums';

export interface Document {
  id: string;
  title: string;
  category: DocumentCategory;
  file_url: string;
  storage_path?: string;
  file_size_bytes?: number;
  version: number;
  parent_id?: string;
  visible_to: DocumentVisibility;
  condominium_id: string;
  uploaded_by?: string;
  created_at: string;
  deleted_at?: string;
}

export interface DocumentUploadUrl {
  upload_url: string;
  storage_path: string;
}

export interface DocumentsPage {
  data: Document[];
  total: number;
  page: number;
  page_size: number;
}
