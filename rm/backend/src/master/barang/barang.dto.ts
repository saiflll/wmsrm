import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsString,
} from 'class-validator';
import { KategoriBarang } from './barang.entity';

export class CreateBarangDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsNotEmpty()
  @IsString()
  nama: string;

  @IsNotEmpty()
  @IsString()
  satuan: string;

  @IsOptional()
  @IsEnum(KategoriBarang)
  kategori?: KategoriBarang;

  @IsOptional()
  @IsNumber()
  min_stok?: number;

  @IsOptional()
  @IsNumber()
  max_stok?: number;

  @IsOptional()
  @IsString()
  satuan_kecil?: string;

  @IsOptional()
  @IsNumber()
  faktor_konversi?: number;
}

export class UpdateBarangDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  nama?: string;

  @IsOptional()
  @IsString()
  satuan?: string;

  @IsOptional()
  @IsEnum(KategoriBarang)
  kategori?: KategoriBarang;

  @IsOptional()
  @IsNumber()
  min_stok?: number;

  @IsOptional()
  @IsNumber()
  max_stok?: number;

  @IsOptional()
  @IsString()
  satuan_kecil?: string;

  @IsOptional()
  @IsNumber()
  faktor_konversi?: number;
}
