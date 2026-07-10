import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class InboundPlanning {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    no_po: string; // PO number (which corresponds to Surat Jalan 'No.PO/SJ')

    @Column({ nullable: true })
    driver_name: string;

    @Column({ nullable: true })
    plat_nomor: string;

    @Column({ nullable: true })
    supplier: string;

    @Column({ type: 'float', nullable: true })
    qty: number; // planned qty

    @Column({ type: 'float', nullable: true })
    qty_diterima: number; // actual received qty

    @Column({ type: 'simple-json', nullable: true })
    alokasi: { tujuan: string; qty: number }[];

    @Column({ type: 'timestamp', nullable: true })
    estimasi_datang: Date; // Planned ETA

    @Column({ type: 'varchar', default: 'WAIT' })
    status: string; // 'WAIT' | 'FAIL' | 'DONE'

    @Column({ type: 'timestamp', nullable: true })
    tanggal_realisasi: Date; // Actual arrival timestamp

    @Column({ type: 'int', nullable: true })
    selisih_menit: number; // Actual arrival - ETA (in minutes)

    @Column({ type: 'text', nullable: true })
    note: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
