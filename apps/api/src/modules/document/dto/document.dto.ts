import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import type { DocumentCategory, DocumentVisibility } from '@condocloud/shared';

export class CreateDocumentDto {
  @IsString() title!: string;
  @IsEnum(['regulamento', 'ata', 'contrato', 'planta', 'financeiro', 'outro']) category!: DocumentCategory;
  @IsString() file_url!: string;
  @IsOptional() @IsNumber() @Min(0) file_size_bytes?: number;
  @IsOptional() @IsEnum(['all', 'sindico', 'admin']) visible_to?: DocumentVisibility;
  @IsOptional() @IsUUID() parent_id?: string;
}
