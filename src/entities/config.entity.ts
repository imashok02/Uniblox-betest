import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('config')
export class Config {
  @PrimaryColumn()
  key: string;

  @Column()
  value: string;
}
