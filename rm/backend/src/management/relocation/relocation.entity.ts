import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Stock } from '../inventory/stock.entity';
import { Gudang } from '../../master/gudang/gudang.entity';

export enum RelocationStatus {
  DRAFT = 'DRAFT',
  EXECUTED = 'EXECUTED',
}

@Entity()
export class Relocation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Stock, { eager: true, nullable: true, onDelete: 'SET NULL' })
  source_stock: Stock;

  @ManyToOne(() => Gudang, { eager: true })
  target_gudang: Gudang;

  @Column({ type: 'float' })
  qty: number;

  @Column({ type: 'varchar', default: RelocationStatus.DRAFT })
  status: RelocationStatus;

  @Column({ type: 'timestamp', nullable: true })
  executed_at: Date;

  @Column({ nullable: true })
  created_by_username: string;

  @Column({ nullable: true })
  executed_by_username: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
