import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateProposalDto {
  @IsUUID() plan_id!: string;
}

export class TrackInteractionDto {
  @IsOptional() @IsString() viewer_name?: string;
  @IsOptional() @IsEmail() viewer_email?: string;
  @IsEnum(['viewed', 'approved', 'questioned']) action!: 'viewed' | 'approved' | 'questioned';
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsInt() @Min(0) time_on_page_seconds?: number;
}
