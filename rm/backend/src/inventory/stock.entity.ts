import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';

@Entity()
@Index(['barang', 'gudang', 'batch_no'], { unique: true })
export class Stock {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Barang, { eager: true })
  barang: Barang;

  @ManyToOne(() => Gudang, { eager: true })
  gudang: Gudang;

  @Column({ nullable: true })
  batch_no: string;

  @Column({ nullable: true })
  lot_no: string;

  @Column({ type: 'float', default: 0 })
  qty: number;

  @Column({ type: 'float', default: 0 })
  reserved_qty: number; // qty yang sudah di-picking plan tapi belum dikonfirmasi keluar

  @Column({ type: 'timestamp', nullable: true })
  expiry_date: Date;

  @Column({ type: 'varchar', nullable: true })
  satuan: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
