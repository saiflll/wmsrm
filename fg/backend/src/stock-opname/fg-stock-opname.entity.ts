import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fg_stock_opname')
export class FgStockOpname {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  tanggalOpname: string;

  @Column({ default: 'MENUNGGU' })
  status: string; // MENUNGGU / DISETUJUI / DITOLAK

  @Column({ nullable: true })
  diajukanOleh: string;

  @Column({ nullable: true })
  disetujuiOleh: string;

  @Column({ type: 'text', nullable: true })
  catatan: string;

  @Column({ nullable: true })
  pdfPath: string;

  @Column({ nullable: true })
  namaInventory: string;

  @Column({ nullable: true })
  namaSupervisor: string;

  @Column({ nullable: true })
  namaAdmin: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
