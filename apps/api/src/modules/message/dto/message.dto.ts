import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import type { MessageAudience } from '@condocloud/shared';

export class CreateMessageDto {
  @IsString() title!: string;
  @IsString() content!: string;
  @IsEnum(['all', 'block', 'unit']) audience!: MessageAudience;
  @IsOptional() @IsUUID() target_id?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsISO8601() publish_at?: string;
}
