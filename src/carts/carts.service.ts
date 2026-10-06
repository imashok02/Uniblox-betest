import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartStatus } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { ProductsService } from '../products/products.service';
import { AddItemDto } from './dto/add-item.dto';

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    private productsService: ProductsService,
  ) {}

  async create(): Promise<Cart> {
    const cart = this.cartRepository.create({ status: CartStatus.ACTIVE });
    return this.cartRepository.save(cart);
  }

  async findOne(id: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      throw new NotFoundException(`Cart ${id} not found`);
    }

    return cart;
  }

  async addItem(cartId: string, dto: AddItemDto): Promise<Cart> {
    const cart = await this.findOne(cartId);

    if (cart.status !== CartStatus.ACTIVE) {
      throw new BadRequestException('Cart has already been checked out');
    }

    const product = await this.productsService.findOne(dto.productId);
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    // Check if product is already in cart
    const existingItem = cart.items.find(
      (item) => item.productId === dto.productId,
    );

    if (existingItem) {
      existingItem.quantity += dto.quantity;
      existingItem.priceInCentsSnapshot = product.priceInCents;
      await this.cartItemRepository.save(existingItem);
    } else {
      const cartItem = this.cartItemRepository.create({
        cartId,
        productId: dto.productId,
        quantity: dto.quantity,
        priceInCentsSnapshot: product.priceInCents,
      });
      await this.cartItemRepository.save(cartItem);
    }

    return this.findOne(cartId);
  }

  async updateItem(
    cartId: string,
    itemId: string,
    quantity: number,
  ): Promise<Cart> {
    const cart = await this.findOne(cartId);

    if (cart.status !== CartStatus.ACTIVE) {
      throw new BadRequestException('Cart has already been checked out');
    }

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found in cart`);
    }

    item.quantity = quantity;
    await this.cartItemRepository.save(item);

    return this.findOne(cartId);
  }

  async removeItem(cartId: string, itemId: string): Promise<Cart> {
    const cart = await this.findOne(cartId);

    if (cart.status !== CartStatus.ACTIVE) {
      throw new BadRequestException('Cart has already been checked out');
    }

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found in cart`);
    }

    await this.cartItemRepository.remove(item);

    return this.findOne(cartId);
  }

  calculateCartTotal(cart: Cart): {
    subtotal: number;
    itemCount: number;
  } {
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + item.priceInCentsSnapshot * item.quantity;
    }, 0);

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return { subtotal, itemCount };
  }
}
