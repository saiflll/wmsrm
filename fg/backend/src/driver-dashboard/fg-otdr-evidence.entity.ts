import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_otdr_bukti_terima')
export class FgOtdrEvidence {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampSubmit: Date;

  @Column()
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
  nopol: string;

  @Column({ nullable: true })
  waSopir: string;

  @Column({ nullable: true })
  namaSopir: string;

  @Column({ nullable: true })
  statusTerimaSopir: string;

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

  @Column({ nullable: true })
  userAgentSumber: string;
}
