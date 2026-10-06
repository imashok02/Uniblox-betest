import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Cart', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartId' })
  cart: any;

  @Column()
  cartId: string;

  @ManyToOne('Product')
  @JoinColumn({ name: 'productId' })
  product: any;

  @Column()
  productId: string;

  @Column({ type: 'integer' })
  quantity: number;

  // Snapshot of price at time of adding to cart (for display)
  // Actual price at checkout may differ - will be recalculated
  @Column({ type: 'integer' })
  priceInCentsSnapshot: number;
}
