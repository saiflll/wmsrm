import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class AlokasiItemDto {
  @IsString()
  tujuan: string;

  @IsNumber()
  qty: number;
}

export class InboundItemDto {
  @IsNotEmpty()
  @IsString()
  no_po: string;

  @IsNotEmpty()
  @IsNumber()
  barang_id: number;

  @IsNotEmpty()
  @IsNumber()
  gudang_id: number;

  @IsNotEmpty()
  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsOptional()
  @IsString()
  batch_no?: string;

  @IsOptional()
  @IsString()
  lot_no?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  jam_datang?: string;

  @IsOptional()
  @IsDateString()
  tanggal_income?: string;

  @IsOptional()
  @IsString()
  jam_bongkar?: string;

  @IsOptional()
  @IsString()
  jam_selesai?: string;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class InboundPostDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundItemDto)
  items: InboundItemDto[];
}

export class OutboundItemDto {
  @IsOptional()
  @IsString()
  no_ref?: string;

  @IsNotEmpty()
  @IsNumber()
  barang_id: number;

  @IsNotEmpty()
  @IsNumber()
  gudang_id: number;

  @IsNotEmpty()
  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsOptional()
  @IsString()
  tujuan?: string;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsString()
  batch_no?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  keterangan?: string;

  @IsOptional()
  @IsString()
  jam_datang?: string;

  @IsOptional()
  @IsString()
  jam_bongkar?: string;

  @IsOptional()
  @IsString()
  jam_selesai?: string;
}

export class OutboundPostDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutboundItemDto)
  items: OutboundItemDto[];
}

export class RelocationDto {
  @IsNotEmpty()
  @IsNumber()
  stock_id: number;

  @IsNotEmpty()
  @IsNumber()
  gudang_tujuan_id: number;

  @IsNotEmpty()
  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  no_po?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class OpnameDto {
  @IsNotEmpty()
  @IsNumber()
  gudang_id: number;

  @IsOptional()
  @IsNumber()
  stock_id?: number;

  @IsNotEmpty()
  @IsNumber()
  qty_opname: number;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class PickingItemDto {
  @IsOptional()
  @IsString()
  no_ref?: string;

  @IsNotEmpty()
  @IsNumber()
  barang_id: number;

  @IsNotEmpty()
  @IsNumber()
  gudang_id: number;

  @IsNotEmpty()
  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsOptional()
  @IsString()
  tujuan?: string;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsString()
  batch_no?: string;

  @IsOptional()
  @IsNumber()
  actual_qty?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiItemDto)
  alokasi?: AlokasiItemDto[];

  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class PickingPostDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickingItemDto)
  items: PickingItemDto[];
}

export class ConfirmPickingDto {
  @IsNotEmpty()
  @IsString()
  no_ref: string;
}
