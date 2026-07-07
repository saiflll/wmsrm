import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_log_update_lokasi')
export class FgLogLokasi {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampUpdate: Date;

  @Column()
  idStock: string;

  @Column()
  namaBarang: string;

  @Column()
  lokasiLama: string;

  @Column()
  lokasiBaru: string;

  @Column()
  statusLama: string;

  @Column()
  statusBaru: string;

  @Column()
  picKoordinator: string;

  @Column({ nullable: true })
  keterangan: string;

  @Column()
  namaUserUpdate: string;
}
