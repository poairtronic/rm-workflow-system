import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessRuleException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        statusCode,
        error: 'BusinessRuleViolation',
        message,
      },
      statusCode,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, identifier: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'NotFound',
        message: `${resource} with identifier '${identifier}' was not found.`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
