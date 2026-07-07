import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_barang_keluar')
export class FgBarangKeluar {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampInput: Date;

  @Column({ type: 'date' })
  tanggalDimuat: string;

  @Column()
  kodeResto: string;

  @Column()
  namaResto: string;

  @Column({ nullable: true })
  nopol: string;

  @Column({ nullable: true })
  waSopir: string;

  @Column({ nullable: true })
  namaSopir: string;

  @Column()
  namaBarang: string;

  @Column({ type: 'int' })
  qtyKeluar: number;

  @Column()
  satuan: string;

  @Column()
  shiftOut: string;

  @Column()
  nomorSuratJalan: string;

  @Column({ nullable: true })
  nomorITKirim: string;

  @Column()
  lokasiRak: string;

  @Column()
  idStock: string;

  @Column({ nullable: true })
  nomorBstb: string;

  @Column({ type: 'date', nullable: true })
  tanggalExpired: string;

  @Column({ nullable: true })
  idOtdr: string;

  @Column({ nullable: true })
  keterangan: string;

  @Column()
  namaUserTransaksi: string;

  @Column({ type: 'date', nullable: true })
  tanggalUpdateITKirim: string;

  @Column({ nullable: true })
  adminUpdateITKirim: string;

  @Column()
  nomorBatch: string;

  @Column({ nullable: true })
  nomorPO: string;

  @Column({ nullable: true })
  idPicking: string;

  @Column({ nullable: true })
  rowPickingList: string;

  @Column({ nullable: true })
  statusRelasiPicking: string;
}
