import { IsOptional, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsUUID()
  couponCode?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
