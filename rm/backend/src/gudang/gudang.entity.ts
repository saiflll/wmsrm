import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Barang } from '../barang/barang.entity';

export enum GudangType {
    SINGLE_DEEP = 'Single Deep',
    DOUBLE_DEEP = 'Double Deep',
}

export enum GudangZone {
    CS_FROZEN = 'CS FROZEN',
    CHILL = 'CHILL',
    DRY_A = 'DRY A',
    DRY_B = 'DRY B',
    DRY_FG = 'DRY FG',
    WASTE = 'WASTE',
}

@Entity()
export class Gudang {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'boolean' })
    side: boolean; // true=dry, false=wet

    @Column()
    name: string; // rack number e.g. A1.1

    @Column({ type: 'varchar', nullable: true })
    zone: string; // CS FROZEN, CHILL, DRY A, etc

    @Column({ type: 'varchar', default: GudangType.SINGLE_DEEP })
    type: GudangType;

    @Column({ type: 'boolean', default: true })
    status: boolean; // available or not

    @Column({ type: 'int', comment: '1,2,3' })
    level: number;

    @Column({ nullable: true })
    kolom: string; // A, B, C ...

    @Column({ type: 'float', default: 1000, nullable: true })
    capacity: number; // kapasitas maksimal gudang/rak

    @ManyToOne(() => Barang, { nullable: true, eager: true })
    barang: Barang;

    @CreateDateColumn()
    created_at: Date;
}
