import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { VoteOption } from '@condocloud/shared';

export class CreateAssemblyDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsISO8601() date!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsInt() @Min(0) quorum_required?: number;
}

export class CreateAssemblyItemDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) order_index?: number;
}

export class VoteDto {
  @IsEnum(['yes', 'no', 'abstain']) vote!: VoteOption;
}
