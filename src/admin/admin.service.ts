import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Coupon, CouponStatus } from '../entities/coupon.entity';
import { Config } from '../entities/config.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
    @InjectRepository(Config)
    private configRepository: Repository<Config>,
    private dataSource: DataSource,
  ) {}

  async getConfig(key: string, defaultValue: string): Promise<string> {
    const config = await this.configRepository.findOne({ where: { key } });
    return config ? config.value : defaultValue;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.configRepository.save({ key, value });
  }

  async generateCoupon(): Promise<Coupon> {
    return await this.dataSource.transaction(async (manager) => {
      // Get configuration
      const nConfig = await manager.findOne(Config, {
        where: { key: 'COUPON_FREQUENCY' },
      });
      const xConfig = await manager.findOne(Config, {
        where: { key: 'COUPON_DISCOUNT_PERCENT' },
      });

      const n = nConfig ? parseInt(nConfig.value) : 5;
      const x = xConfig ? parseInt(xConfig.value) : 10;

      // Count total successful orders
      const orderCount = await manager.count(Order);

      if (orderCount === 0) {
        throw new ConflictException('No orders have been placed yet');
      }

      // Calculate which milestone this is
      const eligibleMilestones: number[] = [];
      for (let i = n; i <= orderCount; i += n) {
        eligibleMilestones.push(i);
      }

      // Check which milestones already have coupons
      const existingCoupons = await manager.find(Coupon);
      const existingMilestones = new Set(
        existingCoupons.map((c) => c.milestoneOrderNumber),
      );

      // Find the first unrewarded milestone
      const unrewardedMilestone = eligibleMilestones.find(
        (m) => !existingMilestones.has(m),
      );

      if (!unrewardedMilestone) {
        throw new ConflictException('No unrewarded milestones available');
      }

      // Generate unique coupon code
      const code = `REWARD-${unrewardedMilestone}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const coupon = manager.create(Coupon, {
        code,
        discountPercent: x,
        status: CouponStatus.AVAILABLE,
        milestoneOrderNumber: unrewardedMilestone,
      });

      return await manager.save(Coupon, coupon);
    });
  }

  async getReport() {
    const orders = await this.orderRepository.find({ relations: ['items'] });
    const coupons = await this.couponRepository.find();

    // Calculate product quantities
    const productQuantities: Record<string, { name: string; quantity: number }> = {};

    for (const order of orders) {
      for (const item of order.items) {
        if (!productQuantities[item.productId]) {
          productQuantities[item.productId] = {
            name: item.productName,
            quantity: 0,
          };
        }
        productQuantities[item.productId].quantity += item.quantity;
      }
    }

    // Calculate revenue
    const grossRevenue = orders.reduce(
      (sum, order) => sum + order.subtotalInCents,
      0,
    );
    const totalDiscounts = orders.reduce(
      (sum, order) => sum + order.discountInCents,
      0,
    );
    const netRevenue = grossRevenue - totalDiscounts;

    // Count coupons
    const couponsGenerated = coupons.length;
    const couponsAvailable = coupons.filter(
      (c) => c.status === CouponStatus.AVAILABLE,
    ).length;
    const couponsRedeemed = coupons.filter(
      (c) => c.status === CouponStatus.REDEEMED,
    ).length;

    return {
      totalOrders: orders.length,
      productsSold: Object.entries(productQuantities).map(
        ([productId, data]) => ({
          productId,
          productName: data.name,
          quantitySold: data.quantity,
        }),
      ),
      revenue: {
        grossRevenueInCents: grossRevenue,
        totalDiscountsInCents: totalDiscounts,
        netRevenueInCents: netRevenue,
      },
      coupons: {
        generated: couponsGenerated,
        available: couponsAvailable,
        redeemed: couponsRedeemed,
      },
    };
  }
}
