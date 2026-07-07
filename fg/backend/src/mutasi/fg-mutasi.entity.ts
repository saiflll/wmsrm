import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_mutasi_barang')
export class FgMutasi {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampInput: Date;

  @Column()
  jenisMutasi: string;

  @Column({ type: 'date' })
  tanggalTransaksi: string;

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

  @Column({ type: 'int', default: 0 })
  qtyMasuk: number;

  @Column({ type: 'int', default: 0 })
  qtyKeluar: number;

  @Column({ type: 'int', default: 0 })
  saldoAkhirLot: number;

  @Column()
  satuan: string;

  @Column()
  idStock: string;

  @Column({ nullable: true })
  nomorBstb: string;

  @Column({ nullable: true })
  nomorITKirim: string;

  @Column({ nullable: true })
  kodeResto: string;

  @Column({ nullable: true })
  namaResto: string;

  @Column({ nullable: true })
  nomorSuratJalan: string;

  @Column()
  shiftKoordinator: string;

  @Column({ nullable: true })
  keterangan: string;

  @Column()
  namaUserTransaksi: string;

  @Column({ nullable: true })
  nomorITTerima: string;

  @Column({ type: 'date', nullable: true })
  timestampUpdateIT: string;

  @Column({ nullable: true })
  adminUpdateIT: string;

  @Column()
  nomorBatch: string;
}
