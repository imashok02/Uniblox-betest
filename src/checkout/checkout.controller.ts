import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post(':cartId')
  async checkout(@Param('cartId') cartId: string, @Body() dto: CheckoutDto) {
    return this.checkoutService.checkout(
      cartId,
      dto.couponCode,
      dto.idempotencyKey,
    );
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string) {
    return this.checkoutService.findOne(id);
  }

  @Get('orders')
  async getAllOrders() {
    return this.checkoutService.findAll();
  }
}
