import { Controller, Post, Get, Param, Body, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { FgStockOpnameService } from './fg-stock-opname.service.js';

@Controller('stock-opname')
export class FgStockOpnameController {
  constructor(private service: FgStockOpnameService) {}

  @Post('submit')
  async submit(@Body() body: any) {
    return this.service.submit({
      tanggalOpname: body.tanggalOpname,
      diajukanOleh: body.diajukanOleh || '',
      namaInventory: body.namaInventory || '',
      namaSupervisor: body.namaSupervisor || '',
      namaAdmin: body.namaAdmin || '',
      catatan: body.catatan || '',
      items: body.items || [],
    });
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(parseInt(id, 10));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() body: any) {
    return this.service.approve(parseInt(id, 10), body.disetujuiOleh || body.user || '');
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body: any) {
    return this.service.reject(parseInt(id, 10), body.catatan || '');
  }

  @Post(':id/upload-pdf')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'stock-opname');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const name = `opname-${uuid()}${extname(file.originalname)}`;
        cb(null, name);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        cb(new BadRequestException('Hanya file PDF yang diizinkan'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  async uploadPdf(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File PDF diperlukan');
    return this.service.uploadPdf(parseInt(id, 10), file.filename);
  }

  @Get('pdf/:filename')
  async servePdf(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', 'stock-opname', filename);
    if (!existsSync(filePath)) {
      throw new BadRequestException('File tidak ditemukan');
    }
    res.sendFile(filePath);
  }

  @Post(':id/delete')
  async delete(@Param('id') id: string) {
    return this.service.delete(parseInt(id, 10));
  }
}
