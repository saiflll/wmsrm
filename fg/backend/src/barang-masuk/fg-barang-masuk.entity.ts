import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_barang_masuk')
export class FgBarangMasuk {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampInput: Date;

  @Column({ type: 'date' })
  tanggalBstb: string;

  @Column({ type: 'date' })
  tanggalProduksi: string;

  @Column({ type: 'date', nullable: true })
  tanggalExpired: string;

  @Column()
  namaBarang: string;

  @Column({ type: 'int' })
  totalQty: number;

  @Column()
  satuan: string;

  @Column()
  status: string;

  @Column()
  shiftIn: string;

  @Column()
  nomorBstb: string;

  @Column()
  lokasiRak: string;

  @Column({ nullable: true })
  nomorITKirim: string;

  @Column({ nullable: true })
  keterangan: string;

  @Column()
  jamIn: string;

  @Column()
  namaUserTransaksi: string;

  @Column({ nullable: true })
  nomorITTerima: string;

  @Column({ type: 'date', nullable: true })
  tanggalUpdateITTerima: string;

  @Column({ nullable: true })
  adminUpdateITTerima: string;

  @Column()
  nomorBatch: string;

  @Column({ nullable: true })
  waktuMasukCS: string;
}
