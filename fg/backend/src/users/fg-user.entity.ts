import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("fg_database_user")
export class FgUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  namaUser: string;

  @Column()
  role: string;

  @Column({ default: "TIDAK" })
  aksesBarangMasuk: string;

  @Column({ default: "TIDAK" })
  aksesBarangKeluar: string;

  @Column({ default: "TIDAK" })
  aksesOtdr: string;

  @Column({ default: "TIDAK" })
  aksesLokasi: string;

  @Column({ default: "TIDAK" })
  aksesSupervisor: string;

  @Column({ default: "AKTIF" })
  status: string;

  @Column({ default: "Shift 1" })
  shift: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
