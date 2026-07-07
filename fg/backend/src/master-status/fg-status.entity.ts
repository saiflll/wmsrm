import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('fg_database_status')
export class FgStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  status: string;
}
