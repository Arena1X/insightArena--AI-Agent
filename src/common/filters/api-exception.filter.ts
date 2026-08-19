import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

interface ExceptionPayload {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.getPayload(exception);
    const message = payload.message ?? 'Internal server error';
    const details = Array.isArray(message) ? message : undefined;

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      error: payload.error ?? this.defaultError(status),
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    });
  }

  private getPayload(exception: unknown): ExceptionPayload {
    if (!(exception instanceof HttpException)) {
      return { error: 'Internal Server Error' };
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { message: response, error: exception.name };
    }

    return response as ExceptionPayload;
  }

  private defaultError(status: number): string {
    const defaultMessage = HttpStatus[status];
    return defaultMessage
      ? defaultMessage
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : 'Error';
  }
}
