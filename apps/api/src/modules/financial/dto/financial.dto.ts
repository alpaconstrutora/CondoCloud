import { IsBoolean, IsDateString, IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import type { FinancialType } from '@condocloud/shared';

export class CreateFinancialRecordDto {
  @IsEnum(['income', 'expense']) type!: FinancialType;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsUUID() unit_id?: string;
  @IsOptional() @IsDateString() due_date?: string;
  @IsOptional() @IsDateString() competencia?: string;
  @IsOptional() @IsDateString() paid_at?: string;
  @IsOptional() @IsString() payment_method?: string;
  @IsOptional() @Transform(({ value }) => value ?? null) @IsString() receipt_url?: string | null;
}

export class GenerateChargesFromRateioDto {
  @IsString() competencia!: string; // "YYYY-MM"

  @IsIn(['igualitario', 'fracaoIdeal', 'consumoIndividual', 'misto'])
  method!: 'igualitario' | 'fracaoIdeal' | 'consumoIndividual' | 'misto';

  @IsIn(['unit', 'resident']) billing_target!: 'unit' | 'resident';

  @IsOptional() @IsIn(['equal', 'responsible']) split_mode?: 'equal' | 'responsible';

  @IsDateString() due_date!: string; // "YYYY-MM-DD"

  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsObject() mistoMethods?: Record<string, 'igualitario' | 'fracaoIdeal'>;

  @IsOptional() @IsObject() consumoIndividual?: Record<string, number>;

  @IsOptional() @IsBoolean() force_cancel?: boolean;
}
