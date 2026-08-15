import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Barang } from '../../master/barang/barang.entity';
import { Shift } from '../../master/shifts/shift.entity';

@Entity()
export class PlanningAyam {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Barang, { eager: true })
  barang: Barang;

  @Column({ type: 'float' })
  qty: number;

  @Column({ type: 'float', default: 0 })
  processed_qty: number;

  @Column({ nullable: true })
  satuan: string;

  @Column({ type: 'date' })
  tanggal_planning: Date;

  @ManyToOne(() => Shift, { eager: true, nullable: true })
  shift: Shift;

  @Column({ nullable: true })
  tujuan: string;

  @Column({ type: 'varchar', default: 'WAIT' })
  status: string; // 'WAIT' | 'PROGRESS' | 'PUBLISH_READY' | 'DONE' | 'CANCEL'

  @Column({ type: 'varchar', length: 100, nullable: true })
  rak_asal: string;

  @Column({ type: 'text', nullable: true })
  keterangan: string;

  @Column({ nullable: true })
  created_by_username: string;

  @Column({ nullable: true })
  executed_by_username: string;

  @Column({ type: 'timestamp', nullable: true })
  executed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: number;
}
