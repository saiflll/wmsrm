import { IsNotEmpty, IsOptional, IsString, IsDateString, IsNumber } from 'class-validator';

export class CreateInboundPlanningDto {
    @IsNotEmpty() @IsString()
    no_po: string;

    @IsOptional() @IsString()
    driver_name?: string;

    @IsOptional() @IsString()
    plat_nomor?: string;

    @IsOptional() @IsString()
    supplier?: string;

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
