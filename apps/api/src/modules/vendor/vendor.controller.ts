import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateVendorDto, CreateVendorAccessDto, CheckInDto } from './dto/vendor.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @Body() dto: CreateVendorDto,
  ): Promise<ApiResponse> {
    const vendor = await this.vendorService.create(condoId, dto);
    return ApiResponse.ok(vendor, 'Prestador cadastrado');
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async findAll(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const vendors = await this.vendorService.findAll(condoId);
    return ApiResponse.ok(vendors);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async update(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateVendorDto>,
  ): Promise<ApiResponse> {
    const vendor = await this.vendorService.update(condoId, id, dto);
    return ApiResponse.ok(vendor, 'Fornecedor atualizado');
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async remove(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.vendorService.remove(condoId, id);
    return ApiResponse.ok(null, 'Fornecedor excluído');
  }

  @Post(':id/accesses')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async createAccess(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: CreateVendorAccessDto,
  ): Promise<ApiResponse> {
    const access = await this.vendorService.createAccess(condoId, id, dto);
    return ApiResponse.ok(access, 'QR Code gerado');
  }

  @Get(':id/accesses')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async listAccesses(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const accesses = await this.vendorService.listAccesses(condoId, id);
    return ApiResponse.ok(accesses);
  }

  // Rota pública — usada pelo porteiro no QR reader (sem autenticação de morador)
  @Public()
  @Post('accesses/check-in')
  async checkIn(@Body() dto: CheckInDto): Promise<ApiResponse> {
    const access = await this.vendorService.checkIn(dto.qr_code);
    return ApiResponse.ok(access, 'Entrada registrada');
  }
}
