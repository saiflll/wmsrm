import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';
import { User } from '../../admin/users/user.entity';
import { Shift } from '../../master/shifts/shift.entity';

export enum LogType {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  RELOCATION = 'RELOCATION',
  ADJUST = 'ADJUST',
  OPNAME = 'OPNAME',
  PICKING = 'PICKING',
}

@Entity()
@Index('IDX_stock_log_type_created', ['type', 'created_at'])
@Index('IDX_stock_log_no_po', ['no_po'])
@Index('IDX_stock_log_no_ref', ['no_ref'])
export class StockLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  type: LogType;

  @Column({ nullable: true })
  no_po: string;

  @Column({ nullable: true })
  no_ref: string; // ID Transaksi group

  @ManyToOne(() => Barang, { eager: true })
  barang: Barang;

  @ManyToOne(() => Gudang, { eager: true, nullable: true })
  gudang: Gudang;

  @ManyToOne(() => Gudang, { eager: true, nullable: true })
  gudang_tujuan: Gudang; // for relocation

  @Column({ type: 'float', default: 0 })
  qty: number;

  @Column({ nullable: true })
  satuan: string;

  @Column({ nullable: true })
  batch_no: string;

  @Column({ nullable: true })
  lot_no: string;

  @Column({ type: 'timestamp', nullable: true })
  expiry_date: Date;

  @Column({ nullable: true })
  supplier: string;

  @Column({ nullable: true })
  tujuan: string; // picking destination

  @Column({ nullable: true })
  status: string; // 'RESERVED' | 'CONFIRMED' for picking logs

  @Column({ type: 'float', nullable: true })
  actual_qty: number;

  @Column({ type: 'simple-json', nullable: true })
  alokasi: { tujuan: string; qty: number }[];

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @ManyToOne(() => Shift, { eager: true, nullable: true })
  shift: Shift;

  @ManyToOne(() => User, { eager: true, nullable: true })
  user: User;

  @Column({ nullable: true })
  user_id: number;

  @Column({ type: 'date', nullable: true })
  tanggal_income: string;

  @Column({ type: 'time', nullable: true })
  jam_datang: string;

  @Column({ type: 'time', nullable: true })
  jam_bongkar: string;

  @Column({ type: 'time', nullable: true })
  jam_selesai: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: number;
}
