import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        console.error('🔥 Exception caught by GlobalExceptionFilter:', exception);
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            message = typeof res === 'string' ? res : (res as any).message || exception.message;
            if (Array.isArray(message)) message = message.join(', ');
        } else if (exception?.code === '23505') {
            // PostgreSQL unique violation
            status = HttpStatus.CONFLICT;
            message = 'Data sudah ada (duplicate)';
        } else if (exception?.code === '23503') {
            // Foreign key violation
            status = HttpStatus.BAD_REQUEST;
            message = 'Data terkait tidak ditemukan';
        }

        response.status(status).json({
            status: false,
            message,
            data: null,
        });
    }
}
