import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum KategoriBarang {
  DRY = 'Dry',
  WET = 'Wet',
  WASTE = 'Waste',
}

@Entity()
@Index('IDX_barang_side_deleted', ['side', 'deleted_at'])
@Index('IDX_barang_nama', ['nama'])
export class Barang {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  sku: string;

  @Column()
  nama: string;

  @Column({ type: 'varchar', default: KategoriBarang.DRY })
  kategori: KategoriBarang;

  @Column({ type: 'boolean', comment: '1:dry, 0:wet' })
  side: boolean;

  @Column()
  satuan: string;

  @Column({ nullable: true })
  satuan_kecil: string;

  @Column({ type: 'float', default: 1 })
  faktor_konversi: number;

  @Column({ type: 'int', default: 0 })
  stok: number;

  @Column({ type: 'int', default: 0 })
  min_stok: number;

  @Column({ type: 'int', default: 1000 })
  max_stok: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: number;
}
