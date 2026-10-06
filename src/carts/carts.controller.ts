import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartsService } from './carts.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Post()
  async create() {
    const cart = await this.cartsService.create();
    return { id: cart.id, status: cart.status, items: [] };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cart = await this.cartsService.findOne(id);
    const { subtotal, itemCount } = this.cartsService.calculateCartTotal(cart);

    return {
      id: cart.id,
      status: cart.status,
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        priceInCents: item.priceInCentsSnapshot,
        lineTotal: item.priceInCentsSnapshot * item.quantity,
      })),
      itemCount,
      subtotalInCents: subtotal,
    };
  }

  @Post(':id/items')
  async addItem(@Param('id') id: string, @Body() dto: AddItemDto) {
    await this.cartsService.addItem(id, dto);
    return this.findOne(id);
  }

  @Put(':id/items/:itemId')
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    await this.cartsService.updateItem(id, itemId, dto.quantity);
    return this.findOne(id);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    await this.cartsService.removeItem(id, itemId);
  }
}

