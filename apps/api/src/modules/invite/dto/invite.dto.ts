import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInviteDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  unit_id?: string;

  @IsEnum(['morador', 'prestador'])
  role: 'morador' | 'prestador' = 'morador';

  @IsEnum(['whatsapp', 'email', 'qr', 'csv'])
  channel: 'whatsapp' | 'email' | 'qr' | 'csv' = 'whatsapp';
}

export class AcceptInviteDto {
  @IsString()
  name: string = '';

  @IsOptional()
  @IsString()
  phone?: string;
}
