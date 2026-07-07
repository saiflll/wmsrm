import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_admin_it')
export class FgAdminIT {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampInput: Date;

  @Column({ type: 'date' })
  tanggalIT: string;

  @Column()
  jenisIT: string;

  @Column({ nullable: true })
  nomorITTerima: string;

  @Column({ nullable: true })
  nomorITKirim: string;

  @Column({ nullable: true })
  nomorReferensiDokumen: string;

  @Column({ nullable: true })
  kodeRestoSupplier: string;

  @Column({ nullable: true })
  namaBarangKeterangan: string;

  @Column({ nullable: true })
  qty: string;

  @Column({ nullable: true })
  catatanAdmin: string;

  @Column()
  namaAdminInput: string;

  @Column({ nullable: true })
  sumberRelasi: string;

  @Column({ nullable: true })
  rowTransaksi: string;

  @Column({ nullable: true })
  statusRelasi: string;
}
