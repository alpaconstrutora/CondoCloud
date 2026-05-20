import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVendorDto {
  @IsOptional() @IsUUID() profile_id?: string;
  @IsOptional() @IsString() company_name?: string;
  @IsOptional() @IsString() document?: string;
  @IsString() specialty!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

export class CreateVendorAccessDto {
  @IsOptional() @IsUUID() ticket_id?: string;
  @IsISO8601() valid_from!: string;
  @IsISO8601() valid_until!: string;
}

export class CheckInDto {
  @IsString() @IsNotEmpty() qr_code!: string;
}
