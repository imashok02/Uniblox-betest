import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

export enum CartStatus {
  ACTIVE = 'active',
  CHECKED_OUT = 'checked_out',
}

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'text',
    default: CartStatus.ACTIVE,
  })
  status: CartStatus;

  @OneToMany('CartItem', 'cart', { cascade: true, eager: true })
  items: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
