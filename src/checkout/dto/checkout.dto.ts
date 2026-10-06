import { IsOptional, IsUUID, IsString } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
