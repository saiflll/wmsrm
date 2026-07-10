import { IsNumber, IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreatePlanningAyamDto {
    @IsNumber()
    barang_id: number;

    @IsNumber()
    qty: number;

    @IsOptional()
    @IsString()
    satuan?: string;

    @IsDateString()
    tanggal_planning: string;

    @IsOptional()
    @IsNumber()
    shift_id?: number;

    @IsOptional()
    @IsString()
    tujuan?: string;

    @IsOptional()
    @IsString()
    @IsIn(['WAIT', 'PROGRESS', 'DONE', 'CANCEL'])
    status?: string;

    @IsOptional()
    @IsString()
    keterangan?: string;
}

export class UpdatePlanningAyamDto {
    @IsOptional()
    @IsNumber()
    barang_id?: number;

    @IsOptional()
    @IsNumber()
    qty?: number;

    @IsOptional()
    @IsString()
    satuan?: string;

    @IsOptional()
    @IsDateString()
    tanggal_planning?: string;

    @IsOptional()
    @IsNumber()
    shift_id?: number;

    @IsOptional()
    @IsString()
    tujuan?: string;

    @IsOptional()
    @IsString()
    @IsIn(['WAIT', 'PROGRESS', 'DONE', 'CANCEL'])
    status?: string;

    @IsOptional()
    @IsString()
    keterangan?: string;
}
