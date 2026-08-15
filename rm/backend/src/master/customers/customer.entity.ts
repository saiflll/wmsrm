import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index('IDX_customer_nama_deleted', ['nama', 'deleted_at'])
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nama: string;

  @Column({ nullable: true })
  alamat: string;

  @Column({ nullable: true })
  telp: string;

  @Column({ type: 'varchar', default: 'customer' })
  tipe: string; // 'customer' | 'supplier'

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: number;
}
