import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('fg_database_resto')
export class FgResto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  kode: string;

  @Column()
  nama: string;

  @Column({ nullable: true })
  nopol: string;

  @Column({ nullable: true })
  wa: string;

  @Column({ nullable: true })
  sopir: string;

  @Column({ nullable: true })
  keterangan: string;
}
