import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_log_import_stock')
export class FgLogImportStock {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampImport: Date;

  @Column()
  idImport: string;

  @Column({ type: 'int' })
  barisTemplate: number;

  @Column()
  namaBarang: string;

  @Column({ type: 'date', nullable: true })
  tanggalProduksi: string;

  @Column({ type: 'date', nullable: true })
  tanggalExpired: string;

  @Column()
  status: string;

  @Column()
  lokasiRak: string;

  @Column({ type: 'int' })
  qtyImport: number;

  @Column()
  satuan: string;

  @Column({ nullable: true })
  nomorBstb: string;

  @Column({ nullable: true })
  nomorITKirim: string;

  @Column()
  shiftKoordinator: string;

  @Column()
  idStock: string;

  @Column()
  statusImport: string;

  @Column({ nullable: true })
  pesan: string;

  @Column()
  namaUserImport: string;
}
