import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FgPickingList } from "./fg-picking-list.entity.js";
import { FgPickingListService } from "./fg-picking-list.service.js";
import { FgPickingListController } from "./fg-picking-list.controller.js";
import { FgStockModule } from "../stock/fg-stock.module.js";
import { FgResto } from "../master-resto/fg-resto.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([FgPickingList, FgResto]), FgStockModule],
  controllers: [FgPickingListController],
  providers: [FgPickingListService],
  exports: [FgPickingListService],
})
export class FgPickingListModule {}
