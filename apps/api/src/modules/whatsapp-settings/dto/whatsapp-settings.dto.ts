import { IsBoolean, IsString } from 'class-validator';

export class ToggleEventDto {
  @IsString()
  event!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateProfileWaDto {
  @IsString()
  whatsapp?: string;

  @IsBoolean()
  whatsapp_opt_in?: boolean;
}
