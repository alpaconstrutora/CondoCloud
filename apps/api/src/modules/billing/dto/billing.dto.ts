import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsOptional() @IsUUID() plan_id?: string;
  @IsOptional() @IsString() plan_name?: string; // alternativa ao plan_id
  @IsOptional() @IsString() success_url?: string;
  @IsOptional() @IsString() cancel_url?: string;
}
