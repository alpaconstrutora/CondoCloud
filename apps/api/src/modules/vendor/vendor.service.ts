import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateVendorDto, CreateVendorAccessDto } from './dto/vendor.dto';

interface Vendor {
  id: string;
  profile_id?: string;
  company_name?: string;
  document?: string;
  specialty: string;
  phone?: string;
  email?: string;
  rating_avg: number;
  rating_count: number;
  condominium_id: string;
  created_at: string;
}

interface VendorAccess {
  id: string;
  vendor_id: string;
  ticket_id?: string;
  valid_from: string;
  valid_until: string;
  qr_code: string;
  used_at?: string;
  condominium_id: string;
  created_at: string;
}

@Injectable()
export class VendorService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(condoId: string, dto: CreateVendorDto): Promise<Vendor> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('vendors')
      .insert({ ...dto, condominium_id: condoId })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Vendor;
  }

  async findAll(condoId: string): Promise<Vendor[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('vendors')
      .select('*')
      .eq('condominium_id', condoId)
      .order('company_name');

    return (data ?? []) as Vendor[];
  }

  async createAccess(condoId: string, vendorId: string, dto: CreateVendorAccessDto): Promise<VendorAccess> {
    const { data: vendor } = await this.supabaseService
      .getAdminClient()
      .from('vendors')
      .select('id')
      .eq('id', vendorId)
      .eq('condominium_id', condoId)
      .single();

    if (!vendor) throw new NotFoundException('Prestador não encontrado');

    const qrCode = uuidv4();

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('vendor_accesses')
      .insert({
        vendor_id: vendorId,
        ticket_id: dto.ticket_id,
        valid_from: dto.valid_from,
        valid_until: dto.valid_until,
        qr_code: qrCode,
        condominium_id: condoId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as VendorAccess;
  }

  async checkIn(qrCode: string): Promise<VendorAccess> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('vendor_accesses')
      .select('*')
      .eq('qr_code', qrCode)
      .is('used_at', null)
      .single();

    if (!data) throw new NotFoundException('QR Code inválido ou já utilizado');

    const access = data as VendorAccess;
    const now = new Date();

    if (now < new Date(access.valid_from) || now > new Date(access.valid_until)) {
      throw new NotFoundException('QR Code fora do período de validade');
    }

    const { data: updated, error } = await this.supabaseService
      .getAdminClient()
      .from('vendor_accesses')
      .update({ used_at: now.toISOString() })
      .eq('qr_code', qrCode)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated as VendorAccess;
  }

  async update(condoId: string, id: string, dto: Partial<CreateVendorDto>): Promise<Vendor> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('vendors')
      .update(dto)
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Vendor;
  }

  async remove(condoId: string, id: string): Promise<void> {
    const { error } = await this.supabaseService
      .getAdminClient()
      .from('vendors')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);
    if (error) throw new Error(error.message);
  }

  async listAccesses(condoId: string, vendorId: string): Promise<VendorAccess[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('vendor_accesses')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false });

    return (data ?? []) as VendorAccess[];
  }
}
