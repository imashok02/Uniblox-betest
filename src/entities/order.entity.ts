import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  cartId: string;

  // Idempotency key for retries
  @Column({ unique: true, nullable: true })
  idempotencyKey: string;

  @OneToMany('OrderItem', 'order', { cascade: true, eager: true })
  items: any[];

  @Column({ type: 'integer' })
  subtotalInCents: number;

  @Column({ type: 'integer', default: 0 })
  discountInCents: number;

  @Column({ type: 'integer' })
  totalInCents: number;

  @Column({ nullable: true })
  couponId: string;

  @Column({ type: 'text', nullable: true })
  couponCode: string;

  @Column({ type: 'integer', nullable: true })
  couponDiscountPercent: number;

  @CreateDateColumn()
  createdAt: Date;
}
