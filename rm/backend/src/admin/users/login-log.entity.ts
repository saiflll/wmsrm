import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class LoginLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  user_agent: string;

  @Column({ default: true })
  success: boolean;

  @CreateDateColumn()
  login_at: Date;
}
