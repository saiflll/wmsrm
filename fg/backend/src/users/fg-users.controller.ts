import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { FgUsersService } from "./fg-users.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FgUsersController {
  constructor(private usersService: FgUsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get("koordinator-in")
  async getKoordinatorIn() {
    return this.usersService.findByRole("KOORDINATOR_IN");
  }

  @Get("koordinator-out")
  async getKoordinatorOut() {
    return this.usersService.findByRole("KOORDINATOR_OUT");
  }

  @Post()
  @Roles("SUPERVISOR", "ADMIN")
  async create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Put(":id")
  @Roles("SUPERVISOR", "ADMIN")
  async update(@Param("id") id: number, @Body() body: any) {
    return this.usersService.update(+id, body);
  }

  @Delete(":id")
  @Roles("SUPERVISOR", "ADMIN")
  async remove(@Param("id") id: number) {
    return this.usersService.remove(+id);
  }
}
