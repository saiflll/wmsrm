import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanningAyam } from '../planning-ayam/planning-ayam.entity';
import { Shift } from '../../master/shifts/shift.entity';

@Entity()
export class OutboundAyam {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PlanningAyam, { eager: true })
  planning_ayam: PlanningAyam;

  @Column({ type: 'float' })
  qty_aktual: number;

  @Column({ nullable: true })
  satuan: string;

  @Column({ type: 'simple-json', nullable: true })
  alokasi: { tujuan: string; qty: number }[];

  @Column({ nullable: true })
  tujuan: string; // primary tujuan (legacy single field)

  @ManyToOne(() => Shift, { eager: true, nullable: true })
  shift: Shift;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_no: string;

  @Column({ type: 'text', nullable: true })
  keterangan: string;

  // ponytail: draft split-processing data, stored as JSON until publish
  @Column({ type: 'simple-json', nullable: true })
  process_data: {
    items: {
      barang_id: number;
      qty: number;
      tujuan: string;
      gudang_id?: number;
      batch_no?: string;
    }[];
    shift_id?: number;
    keterangan?: string;
  } | null;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date;

  @Column({ nullable: true })
  executed_by_username: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: number;
}
