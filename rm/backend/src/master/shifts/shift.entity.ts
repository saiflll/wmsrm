import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: number;
}
