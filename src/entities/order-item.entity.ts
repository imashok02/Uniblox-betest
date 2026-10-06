import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Order', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: any;

  @Column()
  orderId: string;

  // Snapshot data - preserve even if product is deleted/changed
  @Column()
  productId: string;

  @Column()
  productName: string;

  @Column({ type: 'integer' })
  priceInCents: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'integer' })
  lineTotal: number;
}
