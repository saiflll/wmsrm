import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';
import { User } from '../users/user.entity';
import { Shift } from '../shifts/shift.entity';

export enum LogType {
    INBOUND = 'INBOUND',
    OUTBOUND = 'OUTBOUND',
    RELOCATION = 'RELOCATION',
    ADJUST = 'ADJUST',
    OPNAME = 'OPNAME',
    PICKING = 'PICKING',
}

@Entity()
export class StockLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    type: LogType;

    @Column({ nullable: true })
    no_po: string;

    @Column({ nullable: true })
    no_ref: string; // ID Transaksi group

    @ManyToOne(() => Barang, { eager: true })
    barang: Barang;

    @ManyToOne(() => Gudang, { eager: true, nullable: true })
    gudang: Gudang;

    @ManyToOne(() => Gudang, { eager: true, nullable: true })
    gudang_tujuan: Gudang; // for relocation

    @Column({ type: 'float', default: 0 })
    qty: number;

    @Column({ nullable: true })
    satuan: string;

    @Column({ nullable: true })
    batch_no: string;

    @Column({ nullable: true })
    lot_no: string;

    @Column({ type: 'timestamp', nullable: true })
    expiry_date: Date;

    @Column({ nullable: true })
    supplier: string;

    @Column({ nullable: true })
    tujuan: string; // picking destination

    @Column({ nullable: true })
    status: string; // 'RESERVED' | 'CONFIRMED' for picking logs

    @ManyToOne(() => Shift, { eager: true, nullable: true })
    shift: Shift;

    @ManyToOne(() => User, { eager: true, nullable: true })
    user: User;

    @Column({ type: 'date', nullable: true })
    tanggal_income: string;

    @Column({ type: 'time', nullable: true })
    jam_datang: string;

    @Column({ type: 'time', nullable: true })
    jam_bongkar: string;

    @Column({ type: 'time', nullable: true })
    jam_selesai: string;

    @Column({ type: 'text', nullable: true })
    note: string;

    @CreateDateColumn()
    created_at: Date;
}
