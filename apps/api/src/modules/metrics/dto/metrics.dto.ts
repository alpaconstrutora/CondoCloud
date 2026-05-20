import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MetricsQueryDto {
  @IsOptional() @IsString() metric_name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days?: number;
}
