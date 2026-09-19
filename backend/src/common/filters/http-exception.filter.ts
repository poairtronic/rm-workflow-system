import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Catch TypeORM UUID syntax errors
    if (exception && typeof exception === 'object' && 'message' in exception) {
      const msg = String((exception as any).message);
      if (msg.includes('invalid input syntax for type uuid')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid UUID format';
      }
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[AllExceptionsFilter] Internal error:', exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: typeof message === 'object' ? message : { message },
    });
  }
}
