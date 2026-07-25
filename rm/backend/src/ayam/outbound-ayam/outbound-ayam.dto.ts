import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessItemDto {
  @IsNumber()
  barangId: number;

  @IsNumber()
  qty: number;

  @IsString()
  tujuan: string; // destination label OR: 'WASTE' | 'REJECT' | 'RETURN_TO_WH' | 'MISSING'

  @IsOptional()
  @IsNumber()
  gudangId?: number;

  @IsOptional()
  @IsString()
  batch_no?: string;
}

export class ProcessOutboundAyamDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessItemDto)
  items: ProcessItemDto[];

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class PublishOutboundAyamDto {
  @IsOptional()
  @IsString()
  keterangan?: string;
}

class AlokasiItemDto {
  @IsString()
  tujuan: string;

  @IsNumber()
  qty: number;
}

export class CreateOutboundAyamDto {
  @IsNumber()
  planning_ayam_id: number;

  @IsNumber()
  qty_aktual: number;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiItemDto)
  alokasi?: AlokasiItemDto[];

  @IsOptional()
  @IsString()
  tujuan?: string;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class UpdateOutboundAyamDto {
  @IsOptional()
  @IsNumber()
  planning_ayam_id?: number;

  @IsOptional()
  @IsNumber()
  qty_aktual?: number;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiItemDto)
  alokasi?: AlokasiItemDto[];

  @IsOptional()
  @IsString()
  tujuan?: string;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsString()
  keterangan?: string;
}
