import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCommonAreaDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(1) capacity?: number;
  @IsOptional() @IsBoolean() requires_approval?: boolean;
  @IsOptional() @IsNumber() @Min(0) min_advance_hours?: number;
  @IsOptional() @IsNumber() @Min(1) max_duration_hours?: number;
  @IsOptional() @IsNumber() @Min(0) fee?: number;
  @IsOptional() @IsString() rules?: string;
}

export class CreateReservationDto {
  @IsUUID() common_area_id!: string;
  @IsISO8601() starts_at!: string;
  @IsISO8601() ends_at!: string;
  @IsOptional() @IsUUID() unit_id?: string;
  @IsOptional() @IsString() notes?: string;
}
