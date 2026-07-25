import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

class AlokasiItemDto {
  @IsString()
  tujuan: string;

  @IsNumber()
  qty: number;
}

class ProcessInboundItemDto {
  @IsNumber()
  @IsNotEmpty()
  barangId: number;

  @IsNumber()
  @IsNotEmpty()
  gudangId: number;

  @IsNumber()
  @IsNotEmpty()
  qty: number;

  @IsOptional()
  @IsString()
  batch_no?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsDateString()
  tanggal_aktual: string;

  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  jam_datang?: string;

  @IsOptional()
  @IsString()
  jam_bongkar?: string;
}

class RackAllocationDto {
  @Type(() => Number)
  @IsNumber()
  gudangId: number;

  @Type(() => Number)
  @IsNumber()
  qty: number;
}

class InboundPlanItemDto {
  @Type(() => Number)
  @IsNumber()
  barangId: number;

  @Type(() => Number)
  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RackAllocationDto)
  rackAllocations?: RackAllocationDto[];
}

export class CreateInboundPlanningDto {
  @IsNotEmpty()
  @IsString()
  no_po: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsNumber()
  qty?: number;

  @IsOptional()
  @IsNumber()
  qty_diterima?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiItemDto)
  alokasi?: AlokasiItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundPlanItemDto)
  items?: InboundPlanItemDto[];

  @IsOptional()
  @IsDateString()
  estimasi_datang?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateInboundPlanningDto {
  @IsOptional()
  @IsString()
  no_po?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsNumber()
  qty?: number;

  @IsOptional()
  @IsNumber()
  qty_diterima?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiItemDto)
  alokasi?: AlokasiItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundPlanItemDto)
  items?: InboundPlanItemDto[];

  @IsOptional()
  @IsDateString()
  estimasi_datang?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  selisih_menit?: number;

  @IsOptional()
  @IsDateString()
  tanggal_realisasi?: string;
}

export class ProcessInboundDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessInboundItemDto)
  items: ProcessInboundItemDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  shiftId?: number;
}
