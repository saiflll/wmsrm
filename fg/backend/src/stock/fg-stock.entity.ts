import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fg_stock_onhand')
export class FgStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  idStock: string;

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
  stockOnhand: number;

  @Column()
  satuan: string;

  @Column({ nullable: true })
  nomorBstb: string;

  @Column({ type: 'date', nullable: true })
  tanggalBstb: string;

  @Column({ nullable: true })
  nomorITKirimTerakhir: string;

  @UpdateDateColumn()
  lastUpdate: Date;

  @Column()
  keyLot: string;

  @Column({ nullable: true })
  namaUserInputTerakhir: string;

  @Column({ nullable: true })
  nomorITTerimaTerakhir: string;

  @Column({ type: 'date', nullable: true })
  lastUpdateITTerima: string;

  @Column({ nullable: true })
  adminITTerima: string;

  @Column()
  nomorBatch: string;
}
