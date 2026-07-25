import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRelocationDto {
  @IsNotEmpty()
  @IsNumber()
  stock_id: number;

  @IsNotEmpty()
  @IsNumber()
  target_gudang_id: number;

  @IsNotEmpty()
  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ExecuteRelocationDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;
}
