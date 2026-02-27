import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Suplayer {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ nullable: true })
    alamat: string;

    @Column({ nullable: true })
    telp: string;

    @CreateDateColumn()
    created_at: Date;
}
