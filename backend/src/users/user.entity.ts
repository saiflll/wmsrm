import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
    FOREMAN = 1,
    ADMIN = 2,
    SUPER_ADMIN = 3,
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
        default: UserRole.FOREMAN,
    })
    role: UserRole;
}
