import { IsNotEmpty, IsOptional, IsString, IsDateString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AlokasiItemDto {
    @IsString()
    tujuan: string;

    @IsNumber()
    qty: number;
}

export class CreateInboundPlanningDto {
    @IsNotEmpty() @IsString()
    no_po: string;

    @IsOptional() @IsString()
    driver_name?: string;

    @IsOptional() @IsString()
    plat_nomor?: string;

    @IsOptional() @IsString()
    supplier?: string;

    @IsOptional() @IsNumber()
    qty?: number;

    @IsOptional() @IsNumber()
    qty_diterima?: number;

    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AlokasiItemDto)
    alokasi?: AlokasiItemDto[];

    @IsOptional() @IsDateString()
    estimasi_datang?: string;

    @IsOptional() @IsString()
    status?: string;

    @IsOptional() @IsString()
    note?: string;
}

export class UpdateInboundPlanningDto {
    @IsOptional() @IsString()
    no_po?: string;

    @IsOptional() @IsString()
    driver_name?: string;

    @IsOptional() @IsString()
    plat_nomor?: string;

    @IsOptional() @IsString()
    supplier?: string;

    @IsOptional() @IsNumber()
    qty?: number;

    @IsOptional() @IsNumber()
    qty_diterima?: number;

    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AlokasiItemDto)
    alokasi?: AlokasiItemDto[];

    @IsOptional() @IsDateString()
    estimasi_datang?: string;

    @IsOptional() @IsString()
    status?: string;

    @IsOptional() @IsString()
    note?: string;

    @IsOptional() @IsNumber()
    selisih_menit?: number;

    @IsOptional() @IsDateString()
    tanggal_realisasi?: string;
}
