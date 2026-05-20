import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/document.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

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
    @Query('category') category?: string,
  ): Promise<ApiResponse> {
    const docs = await this.documentService.findAll(condoId, category);
    return ApiResponse.ok(docs);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async delete(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.documentService.delete(condoId, id);
    return ApiResponse.ok(null, 'Documento removido');
  }
}
