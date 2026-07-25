import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../master/customers/customer.entity';
import { Shift } from '../../master/shifts/shift.entity';

// ponytail: multi-barang support via items JSON; upgrade to OneToMany relation when item count grows beyond 50
@Entity()
export class PlanningOutbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  no_ref: string; // Reference / DO / SO number

  @ManyToOne(() => Customer, { eager: true, nullable: true })
  customer: Customer;

  @ManyToOne(() => Shift, { eager: true, nullable: true })
  shift: Shift;

  @Column({ type: 'date' })
  tanggal_planning: Date;

  @Column({ type: 'varchar', default: 'WAIT' })
  status: string; // 'WAIT' | 'PROGRESS' | 'DONE' | 'CANCEL'

  @Column({ type: 'text', nullable: true })
  tujuan: string;

  @Column({ type: 'text', nullable: true })
  keterangan: string;

  // Planned items
  @Column({ type: 'simple-json', nullable: true })
  items: {
    barangId: number;
    gudangId: number;
    qty: number;
    batch_no?: string;
    satuan?: string;
  }[];

  // Draft split-processing data saved by operator before publish
  @Column({ type: 'simple-json', nullable: true })
  process_data: {
    items: {
      barangId: number;
      qty: number;
      tujuan: string; // destination OR: 'WASTE' | 'REJECT' | 'RETURN_TO_WH' | 'MISSING'
      gudangId?: number;
      batch_no?: string;
    }[];
    shift_id?: number;
    keterangan?: string;
  } | null;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
