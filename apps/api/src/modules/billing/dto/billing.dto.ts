import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID() plan_id!: string;
  @IsOptional() @IsString() success_url?: string;
  @IsOptional() @IsString() cancel_url?: string;
}
