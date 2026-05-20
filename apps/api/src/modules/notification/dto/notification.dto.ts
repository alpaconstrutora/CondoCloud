import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional() @IsArray() @IsString({ each: true }) silenced_types?: string[];
  @IsOptional() @IsBoolean() reset_cooldown?: boolean;
}
