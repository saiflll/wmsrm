import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
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
}
