import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fg_log_notice_transaksi')
export class FgNoticeTransaksi {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestampNotice: Date;

  @Column()
  jenisTransaksi: string;

  @Column()
  levelNotice: string;

  @Column({ nullable: true })
  keyData: string;

  @Column()
  pesanNotice: string;

  @Column()
  userKoordinator: string;

  @Column({ nullable: true })
  statusTindakan: string;
}
