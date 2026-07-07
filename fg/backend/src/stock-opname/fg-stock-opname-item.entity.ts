import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('fg_stock_opname_item')
export class FgStockOpnameItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  stockOpnameId: number;

  @Column()
  idStock: string;

  @Column()
  namaBarang: string;

  @Column()
  lokasiRak: string;

  @Column({ nullable: true })
  nomorBatch: string;

  @Column({ nullable: true })
  tanggalExpired: string;

  @Column({ type: 'int' })
  qtySistem: number;

  @Column({ type: 'int' })
  qtyActual: number;

  @Column({ type: 'int' })
  selisih: number;

  @Column()
  statusOpname: string; // Sesuai / Tidak Sesuai
}
