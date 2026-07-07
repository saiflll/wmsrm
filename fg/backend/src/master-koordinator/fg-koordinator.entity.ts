import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('fg_database_koordinator')
export class FgKoordinator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nama: string;

  @Column()
  shift: string;
}
