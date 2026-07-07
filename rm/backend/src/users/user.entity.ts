import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
    CHECKER_IB = 1,
    CHECKER_OB = 2,
    KOORDINATOR = 3,
    SUPERVISOR = 4,
    SUPER_ADMIN = 5,
    REVIEWER = 6,
}

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    username: string;

    @Column()
    pass: string; // Will store hashed password

    @Column({
        type: 'int',
        default: UserRole.CHECKER_IB,
    })
    role: UserRole;
}
