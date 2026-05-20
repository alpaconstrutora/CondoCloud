import { IsEnum, IsOptional, IsString, IsUUID, Min, Max, IsInt, IsArray } from 'class-validator';
import type { TicketPriority, TicketCategory, TicketStatus } from '@condocloud/shared';

export class CreateTicketDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(['low', 'medium', 'high', 'urgent']) priority!: TicketPriority;
  @IsEnum(['manutencao', 'seguranca', 'limpeza', 'barulho', 'area_comum', 'outro']) category!: TicketCategory;
  @IsOptional() @IsUUID() unit_id?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['open', 'in_progress', 'resolved', 'closed']) status?: TicketStatus;
  @IsOptional() @IsEnum(['low', 'medium', 'high', 'urgent']) priority?: TicketPriority;
  @IsOptional() @IsUUID() assigned_to?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
}

export class AddTicketUpdateDto {
  @IsString() content!: string;
  @IsOptional() @IsEnum(['open', 'in_progress', 'resolved', 'closed']) status_to?: TicketStatus;
  @IsOptional() @IsArray() @IsString({ each: true }) attachments?: string[];
}
