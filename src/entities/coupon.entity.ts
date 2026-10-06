import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum CouponStatus {
  AVAILABLE = 'available',
  REDEEMED = 'redeemed',
  RESERVED = 'reserved', // Temporarily held during checkout
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'integer' })
  discountPercent: number;

  @Column({
    type: 'text',
    default: CouponStatus.AVAILABLE,
  })
  status: CouponStatus;

  // Which order milestone triggered this coupon (e.g., 5, 10, 15)
  @Column({ type: 'integer' })
  milestoneOrderNumber: number;

  @Column({ nullable: true })
  redeemedByOrderId: string;

  @Column({ nullable: true })
  redeemedAt: Date;

  // For reservation during checkout to prevent double redemption
  @Column({ nullable: true })
  reservedByCartId: string;

  @Column({ nullable: true })
  reservedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
