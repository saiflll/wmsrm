import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FgUser } from "./fg-user.entity.js";
import * as bcrypt from "bcrypt";

@Injectable()
export class FgUsersService {
  constructor(@InjectRepository(FgUser) private userRepo: Repository<FgUser>) {}

  async findAll() {
    return this.userRepo.find({ order: { username: "ASC" } });
  }

  async findByRole(role: string) {
    return this.userRepo.find({
      where: { role, status: "AKTIF" },
      order: { username: "ASC" },
    });
  }

  async create(data: Partial<FgUser>) {
    data.password = await bcrypt.hash(data.password, 10);
    return this.userRepo.save(this.userRepo.create(data));
  }

  async update(id: number, data: Partial<FgUser>) {
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    await this.userRepo.update(id, data);
    return this.userRepo.findOne({ where: { id } });
  }

  async remove(id: number) {
    await this.userRepo.delete(id);
    return { ok: true };
  }

  async seedDefaults() {
    const count = await this.userRepo.count();
    if (count > 0) return;

    const defaults = [
      {
        username: "in1",
        password: await bcrypt.hash("in123", 10),
        namaUser: "Koordinator In 1",
        role: "KOORDINATOR_IN",
        aksesBarangMasuk: "YA",
        status: "AKTIF",
        shift: "Shift 1",
      },
      {
        username: "in2",
        password: await bcrypt.hash("in123", 10),
        namaUser: "Koordinator In 2",
        role: "KOORDINATOR_IN",
        aksesBarangMasuk: "YA",
        status: "AKTIF",
        shift: "Shift 2",
      },
      {
        username: "in3",
        password: await bcrypt.hash("in123", 10),
        namaUser: "Koordinator In 3",
        role: "KOORDINATOR_IN",
        aksesBarangMasuk: "YA",
        status: "AKTIF",
        shift: "Shift 3",
      },
      {
        username: "out1",
        password: await bcrypt.hash("out123", 10),
        namaUser: "Koordinator Out 1",
        role: "KOORDINATOR_OUT",
        aksesBarangKeluar: "YA",
        aksesOtdr: "YA",
        status: "AKTIF",
        shift: "Shift 1",
      },
      {
        username: "out2",
        password: await bcrypt.hash("out123", 10),
        namaUser: "Koordinator Out 2",
        role: "KOORDINATOR_OUT",
        aksesBarangKeluar: "YA",
        aksesOtdr: "YA",
        status: "AKTIF",
        shift: "Shift 2",
      },
      {
        username: "out3",
        password: await bcrypt.hash("out123", 10),
        namaUser: "Koordinator Out 3",
        role: "KOORDINATOR_OUT",
        aksesBarangKeluar: "YA",
        aksesOtdr: "YA",
        status: "AKTIF",
        shift: "Shift 3",
      },
      {
        username: "inv1",
        password: await bcrypt.hash("inv123", 10),
        namaUser: "Inventory 1",
        role: "INVENTORY",
        aksesLokasi: "YA",
        status: "AKTIF",
        shift: "Shift 1",
      },
      {
        username: "qc",
        password: await bcrypt.hash("qc123", 10),
        namaUser: "Quality Control",
        role: "QUALITY_CONTROL",
        status: "AKTIF",
        shift: "Shift 1",
      },
      {
        username: "spv",
        password: await bcrypt.hash("spv123", 10),
        namaUser: "Supervisor",
        role: "SUPERVISOR",
        aksesBarangMasuk: "YA",
        aksesBarangKeluar: "YA",
        aksesOtdr: "YA",
        aksesLokasi: "YA",
        aksesSupervisor: "YA",
        status: "AKTIF",
        shift: "All",
      },
      {
        username: "admin",
        password: await bcrypt.hash("admin123", 10),
        namaUser: "Admin IT",
        role: "ADMIN",
        status: "AKTIF",
        shift: "All",
      },
    ];

    await this.userRepo.save(this.userRepo.create(defaults));
  }
}
