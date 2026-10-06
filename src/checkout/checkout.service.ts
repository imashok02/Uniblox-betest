import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Coupon, CouponStatus } from '../entities/coupon.entity';
import { CartsService } from '../carts/carts.service';
import { CartStatus } from '../entities/cart.entity';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
    private cartsService: CartsService,
    private dataSource: DataSource,
  ) {}

  async checkout(
    cartId: string,
    couponCode?: string,
    idempotencyKey?: string,
  ): Promise<Order> {
    // Check for idempotency - if this exact request was already processed, return existing order
    if (idempotencyKey) {
      const existingOrder = await this.orderRepository.findOne({
        where: { idempotencyKey },
        relations: ['items'],
      });
      if (existingOrder) {
        return existingOrder;
      }
    }

    // Check if cart was already checked out
    const existingOrderByCart = await this.orderRepository.findOne({
      where: { cartId },
      relations: ['items'],
    });
    if (existingOrderByCart) {
      return existingOrderByCart;
    }

    // Use a transaction for atomicity
    return await this.dataSource.transaction(async (manager) => {
      const cart = await this.cartsService.findOne(cartId);

      if (cart.status !== CartStatus.ACTIVE) {
        throw new BadRequestException('Cart has already been checked out');
      }

      if (!cart.items || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // Lock products for update to prevent concurrent overselling
      const productIds = cart.items.map((item) => item.productId);
      const products = await manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write')
        .whereInIds(productIds)
        .getMany();

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Validate inventory and calculate totals using CURRENT prices
      let subtotalInCents = 0;
      const orderItems: Partial<OrderItem>[] = [];

      for (const cartItem of cart.items) {
        const product = productMap.get(cartItem.productId);
        if (!product) {
          throw new NotFoundException(
            `Product ${cartItem.productId} not found`,
          );
        }

        if (product.availableInventory < cartItem.quantity) {
          throw new ConflictException(
            `Insufficient inventory for ${product.name}. Available: ${product.availableInventory}, Requested: ${cartItem.quantity}`,
          );
        }

        // Use current price from product, not snapshot from cart
        const lineTotal = product.priceInCents * cartItem.quantity;
        subtotalInCents += lineTotal;

        orderItems.push({
          productId: product.id,
          productName: product.name,
          priceInCents: product.priceInCents,
          quantity: cartItem.quantity,
          lineTotal,
        });

        // Decrement inventory
        product.availableInventory -= cartItem.quantity;
      }

      // Save updated inventory
      await manager.save(Product, products);

      // Handle coupon if provided
      let coupon: Coupon | null = null;
      let discountInCents = 0;

      if (couponCode) {
        coupon = await manager
          .createQueryBuilder(Coupon, 'coupon')
          .setLock('pessimistic_write')
          .where('coupon.code = :code', { code: couponCode })
          .getOne();

        if (!coupon) {
          throw new NotFoundException(`Coupon ${couponCode} not found`);
        }

        if (coupon.status !== CouponStatus.AVAILABLE) {
          throw new ConflictException(`Coupon ${couponCode} is not available`);
        }

        // Calculate discount
        discountInCents = Math.floor(
          (subtotalInCents * coupon.discountPercent) / 100,
        );

        // Mark coupon as redeemed
        coupon.status = CouponStatus.REDEEMED;
        coupon.redeemedAt = new Date();
      }

      const totalInCents = Math.max(0, subtotalInCents - discountInCents);

      // Create order
      const order = manager.create(Order, {
        cartId,
        idempotencyKey,
        subtotalInCents,
        discountInCents,
        totalInCents,
        couponId: coupon?.id,
        couponCode: coupon?.code,
        couponDiscountPercent: coupon?.discountPercent,
      });

      const savedOrder = await manager.save(Order, order);

      // Create order items
      const orderItemsWithOrderId = orderItems.map((item) => ({
        ...item,
        orderId: savedOrder.id,
      }));
      await manager.save(OrderItem, orderItemsWithOrderId);

      // Update coupon with order reference if used
      if (coupon) {
        coupon.redeemedByOrderId = savedOrder.id;
        await manager.save(Coupon, coupon);
      }

      // Mark cart as checked out
      cart.status = CartStatus.CHECKED_OUT;
      await manager.save(cart);

      // Fetch complete order with items
      return await manager.findOne(Order, {
        where: { id: savedOrder.id },
        relations: ['items'],
      });
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }
}
