import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
