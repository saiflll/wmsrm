import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

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
