import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('fg_database_rak')
export class FgRak {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  lokasiRak: string;

  @Column({ type: 'int', default: 0 })
  kapasitasRak: number;

  @Column({ default: 'DEDICATED' })
  jenisRak: string;
}
