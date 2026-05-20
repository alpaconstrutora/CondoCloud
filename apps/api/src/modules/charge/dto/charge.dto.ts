import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateChargeDto {
  @IsUUID() unit_id!: string;
  @IsOptional() @IsUUID() profile_id?: string;
  @IsString() description!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsDateString() due_date!: string;
}

export class MarkPaidDto {
  @IsOptional() @IsString() payment_method?: string;
  @IsOptional() @IsString() gateway_charge_id?: string;
}
