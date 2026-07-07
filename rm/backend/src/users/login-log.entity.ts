import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class LoginLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ nullable: true })
    username: string;

    @Column({ nullable: true })
    ip: string;

    @Column({ nullable: true })
    userAgent: string;

    @Column({ default: true })
    success: boolean;

    @CreateDateColumn()
    loginAt: Date;
}
