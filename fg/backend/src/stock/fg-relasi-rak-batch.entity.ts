import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_relasi_rak_batch')
export class FgRelasiRakBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampSync: Date;

  @Column()
  idStock: string;

  @Column()
  keyLot: string;

  @Column()
  lokasiRak: string;

  @Column()
  nomorBatch: string;

  @Column()
  namaBarang: string;

  @Column({ type: 'date', nullable: true })
  tanggalProduksi: string;

  @Column({ type: 'date', nullable: true })
  tanggalExpired: string;

  @Column()
  status: string;

  @Column({ type: 'int', default: 0 })
  stockOnhand: number;

  @Column()
  satuan: string;

  @Column({ nullable: true })
  nomorBstb: string;

  @Column({ type: 'date', nullable: true })
  tanggalBstb: string;

  @Column({ nullable: true })
  lastUpdateStock: string;

  @Column({ nullable: true })
  namaUserInputTerakhir: string;
}
