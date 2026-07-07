import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fg_database_barang')
export class FgBarang {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nama: string;

  @Column({ default: 'Carton' })
  satuanDefault: string;

  @Column({ default: 'GOOD' })
  statusDefault: string;

  @Column({ nullable: true })
  lokasiRakDefault: string;

  @Column({ type: 'int', default: 0 })
  umurExpiredBulan: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
