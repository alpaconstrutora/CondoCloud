import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ToggleEventDto {
  @IsString()
  event!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateProfileWaDto {
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsBoolean()
  whatsapp_opt_in?: boolean;
}
