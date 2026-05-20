import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class Step1Dto {
  @IsString()
  name: string = '';

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;
}

export class BlockConfigDto {
  @IsString()
  name: string = '';

  @IsInt()
  @Min(1)
  units_count: number = 10;
}

export class Step2Dto {
  @IsEnum(['quick', 'detailed'])
  mode: 'quick' | 'detailed' = 'quick';

  @IsOptional()
  @IsInt()
  @Min(1)
  total_units?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockConfigDto)
  blocks?: BlockConfigDto[];
}

export class Step4Dto {
  @IsOptional()
  sla_manutencao_hours?: number;

  @IsOptional()
  sla_urgente_hours?: number;

  @IsOptional()
  taxa_condominial?: number;
}
