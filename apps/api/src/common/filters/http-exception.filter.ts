import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    // 统一错误响应格式
    response.status(status).send({
      status,
      success: false,
      message: typeof errorResponse === 'object' 
        ? (errorResponse as any).message || exception.message 
        : exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}