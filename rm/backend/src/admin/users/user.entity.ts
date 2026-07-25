import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  CHECKER = 1,
  ADMIN = 2,
  KOORDINATOR = 3,
  SUPERVISOR = 4,
  SUPER_ADMIN = 5,
  MANAGER = 6,
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  pass: string; // Will store hashed password

  @Column({ default: '' })
  nama: string;

  @Column({
    type: 'int',
    default: UserRole.CHECKER,
  })
  role: UserRole;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: number;
}
