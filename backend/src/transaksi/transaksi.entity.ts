import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Barang } from '../barang/barang.entity';
import { Suplayer } from '../suplayers/suplayer.entity';
import { Gudang } from '../gudang/gudang.entity';
import { Shift } from '../shifts/shift.entity';
import { User } from '../users/user.entity';

export enum TransaksiModel {
    IN = 1,
    OUT = 2,
    REJECT = 3,
}

@Entity()
export class Transaksi {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    jumlah: number;

    @ManyToOne(() => Barang)
    barang: Barang;

    @ManyToOne(() => Suplayer)
    suplayer: Suplayer;

    @ManyToOne(() => Gudang)
    gudang: Gudang;

    @ManyToOne(() => Shift)
    shift: Shift;

    @ManyToOne(() => User)
    user: User;

    @CreateDateColumn()
    datein: Date;

    @Column({ type: 'timestamp', nullable: true })
    exp: Date;

    @Column({ type: 'time', nullable: true })
    jam_datang: string;

    @Column({ type: 'time', nullable: true })
    jam_bongkar: string;

    @Column({ type: 'time', nullable: true })
    jam_selesai: string;

    @Column({ type: 'text', nullable: true })
    foto_url: string;

    @Column({ type: 'text', nullable: true })
    note: string;

    @Column({
        type: 'int',
        default: TransaksiModel.IN,
    })
    model: TransaksiModel;
}
