import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fg_otdr')
export class FgOtdr {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampCreate: Date;

  @UpdateDateColumn()
  timestampUpdate: Date;

  @Column({ unique: true })
  idOtdr: string;

  @Column({ type: 'date' })
  tanggalDimuat: string;

  @Column()
  kodeResto: string;

  @Column()
  namaResto: string;

  @Column()
  nomorSuratJalan: string;

  @Column({ nullable: true })
  nomorITKirim: string;

  @Column({ nullable: true })
  nopol: string;

  @Column({ nullable: true })
  waSopir: string;

  @Column({ nullable: true })
  namaSopir: string;

  @Column({ nullable: true })
  startMuat: string;

  @Column({ nullable: true })
  selesaiMuat: string;

  @Column({ nullable: true })
  namaNamaYangMuat: string;

  @Column({ default: 'DRAFT' })
  statusOtdr: string;

  @Column({ type: 'int', default: 0 })
  totalItemOutput: number;

  @Column({ type: 'int', default: 0 })
  totalQtyOutput: number;

  @Column({ nullable: true })
  catatan: string;

  @Column()
  namaUserCreate: string;

  @Column({ nullable: true })
  namaUserUpdate: string;

  @Column({ nullable: true })
  linkDashboardSopir: string;

  @Column({ nullable: true })
  tokenDashboardSopir: string;

  @Column({ nullable: true })
  statusTerimaSopir: string;

  @Column({ type: 'date', nullable: true })
  tanggalTerimaSopir: string;

  @Column({ nullable: true })
  namaPenerima: string;

  @Column({ nullable: true })
  namaChecker: string;

  @Column({ nullable: true })
  statusChecker: string;

  @Column({ nullable: true })
  linkBuktiFoto: string;

  @Column({ nullable: true })
  catatanBuktiTerima: string;

  @Column({ nullable: true })
  idFileBukti: string;
}
