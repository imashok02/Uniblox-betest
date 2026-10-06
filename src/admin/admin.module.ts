import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Coupon } from '../entities/coupon.entity';
import { Config } from '../entities/config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Coupon, Config])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
