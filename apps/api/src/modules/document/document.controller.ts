import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentDto, GetUploadUrlDto, DocumentQueryDto } from './dto/document.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /** Gera URL assinada para upload direto ao Supabase Storage */
  @Post('upload-url')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async getUploadUrl(
    @CurrentTenant() condoId: string,
    @Body() dto: GetUploadUrlDto,
  ): Promise<ApiResponse> {
    const result = await this.documentService.getUploadUrl(condoId, dto);
    return ApiResponse.ok(result);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateDocumentDto,
  ): Promise<ApiResponse> {
    const doc = await this.documentService.create(condoId, user.id, dto);
    return ApiResponse.ok(doc, 'Documento cadastrado');
  }

  @Get()
  async findAll(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Query() query: DocumentQueryDto,
  ): Promise<ApiResponse> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    const result = await this.documentService.findAll(condoId, user.role, query.category, page, pageSize);
    return ApiResponse.ok(result);
  }

  /** Retorna URL assinada de download (valida visibilidade e registra auditoria) */
  @Get(':id/download')
  async download(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const url = await this.documentService.getDownloadUrl(condoId, id, user.role, user.id);
    return ApiResponse.ok({ url });
  }

  /** Lista todas as versões de um documento */
  @Get(':id/versions')
  async versions(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const versions = await this.documentService.getVersions(condoId, id);
    return ApiResponse.ok(versions);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async delete(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.documentService.delete(condoId, id, user.id);
    return ApiResponse.ok(null, 'Documento removido');
  }
}
