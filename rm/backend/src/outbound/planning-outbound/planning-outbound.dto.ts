import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class PlanItemDto {
  @IsNumber()
  barangId: number;

  @IsNumber()
  gudangId: number;

  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  batch_no?: string;

  @IsOptional()
  @IsString()
  satuan?: string;
}

export class CreatePlanningOutboundDto {
  @IsOptional()
  @IsString()
  no_ref?: string;

  @IsOptional()
  @IsNumber()
  customer_id?: number;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsDateString()
  tanggal_planning: string;

  @IsOptional()
  @IsString()
  tujuan?: string;

  @IsOptional()
  @IsString()
  keterangan?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  items: PlanItemDto[];
}

export class UpdatePlanningOutboundDto {
  @IsOptional()
  @IsString()
  no_ref?: string;

  @IsOptional()
  @IsNumber()
  customer_id?: number;

  @IsOptional()
  @IsNumber()
  shift_id?: number;

  @IsOptional()
  @IsDateString()
  tanggal_planning?: string;

  @IsOptional()
  @IsString()
  tujuan?: string;

  @IsOptional()
  @IsString()
  keterangan?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  items?: PlanItemDto[];
}

class ProcessItemDto {
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

export class ProcessPlanningOutboundDto {
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

export class PublishPlanningOutboundDto {
  @IsOptional()
  @IsString()
  keterangan?: string;
}
