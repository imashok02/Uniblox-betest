import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  // Store price in cents to avoid floating point errors
  @Column({ type: 'integer' })
  priceInCents: number;

  @Column({ type: 'integer', default: 0 })
  availableInventory: number;

  // Optimistic locking for inventory updates
  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
