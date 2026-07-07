import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_picking_list')
export class FgPickingList {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampBuat: Date;

  @Column()
  nomorPO: string;

  @Column({ type: 'date' })
  tanggalMuat: string;

  @Column({ nullable: true })
  kodeResto: string;

  @Column({ nullable: true })
  namaResto: string;

  @Column({ nullable: true })
  nopol: string;

  @Column({ nullable: true })
  namaSopir: string;

  @Column({ nullable: true })
  nomorSuratJalan: string;

  @Column()
  namaBarang: string;

  @Column({ type: 'int' })
  qtyPO: number;

  @Column({ type: 'int' })
  qtyPick: number;

  @Column()
  satuan: string;

  @Column()
  lokasiRak: string;

  @Column()
  idStock: string;

  @Column()
  nomorBatch: string;

  @Column({ type: 'date', nullable: true })
  tanggalProduksi: string;

  @Column({ type: 'date', nullable: true })
  tanggalExpired: string;

  @Column()
  statusStock: string;

  @Column({ nullable: true })
  nomorBstb: string;

  @Column({ default: 'DRAFT PICKING' })
  statusPicking: string;

  @Column({ nullable: true })
  catatan: string;

  @Column()
  dibuatOleh: string;

  @Column()
  idPicking: string;

  @Column({ nullable: true })
  idOtdr: string;

  @Column({ nullable: true })
  rowBarangKeluar: string;

  @Column({ type: 'date', nullable: true })
  timestampBarangKeluar: string;

  @Column({ nullable: true })
  userBarangKeluar: string;
}
