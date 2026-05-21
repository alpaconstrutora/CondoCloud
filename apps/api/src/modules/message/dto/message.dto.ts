import { IsBoolean, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { MessageAudience } from '@condocloud/shared';

export class CreateMessageDto {
  @IsString() title!: string;
  @IsString() content!: string;
  @IsEnum(['all', 'block', 'unit']) audience!: MessageAudience;
  @IsOptional() @IsUUID() target_id?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsISO8601() publish_at?: string;
}

export class MessageQueryDto {
  @IsOptional() @IsString() pinned?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page_size?: number;
}
