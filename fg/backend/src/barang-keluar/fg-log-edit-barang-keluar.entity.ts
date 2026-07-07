import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_log_edit_barang_keluar')
export class FgLogEditBarangKeluar {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampEdit: Date;

  @Column({ type: 'int' })
  rowBarangKeluar: number;

  @Column({ type: 'date', nullable: true })
  tanggalDimuat: string;

  @Column()
  kodeResto: string;

  @Column()
  namaResto: string;

  @Column({ nullable: true })
  nomorSuratJalan: string;

  @Column({ nullable: true })
  idOtdr: string;

  @Column()
  namaBarang: string;

  @Column()
  idStock: string;

  @Column()
  nomorBatch: string;

  @Column()
  lokasiRak: string;

  @Column({ type: 'int' })
  qtyLama: number;

  @Column({ type: 'int' })
  qtyBaru: number;

  @Column({ type: 'int' })
  selisihQty: number;

  @Column({ type: 'int' })
  stockOnhandSetelahEdit: number;

  @Column()
  alasanCatatan: string;

  @Column()
  dieditOleh: string;
}
