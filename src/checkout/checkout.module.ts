import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Coupon } from '../entities/coupon.entity';
import { Config } from '../entities/config.entity';
import { CartsModule } from '../carts/carts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, Coupon, Config]),
    CartsModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
