import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Product } from './entities/product.entity';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Coupon } from './entities/coupon.entity';
import { Config } from './entities/config.entity';
import { ProductsModule } from './products/products.module';
import { CartsModule } from './carts/carts.module';
import { CheckoutModule } from './checkout/checkout.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'ecommerce.db',
      entities: [Product, Cart, CartItem, Order, OrderItem, Coupon, Config],
      synchronize: true, // Auto-create tables in dev (not for production)
      logging: false,
    }),
    ProductsModule,
    CartsModule,
    CheckoutModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
