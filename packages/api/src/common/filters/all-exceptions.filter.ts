import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * A-19: catch-all filter for everything the more-specific HttpExceptionFilter
 * does NOT handle — Prisma errors, multer errors, and any unexpected throw.
 *
 * Nest reverses the global-filter list and selects the first match, so this
 * filter must be registered BEFORE HttpExceptionFilter in main.ts. That way
 * HttpExceptions are claimed by HttpExceptionFilter and only the remainder
 * reach here. Even so, this filter defensively delegates HttpExceptions to the
 * identical envelope, so it is correct in any ordering.
 *
 * The real error is logged server-side; the client only ever receives a clean
 * envelope identical in shape to HttpExceptionFilter's — never a stack trace.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error } = this.resolve(exception);

    const body = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    // Always log the REAL error server-side (with stack), never to the client.
    this.logger.error(
      `${request.method} ${request.url} -> ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string;
    error?: string;
  } {
    // Defensive: an HttpException reaching here (ordering aside) keeps its shape.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === 'string') {
        return { status, message: raw, error: exception.name };
      }
      const structured = raw as { message?: unknown; error?: string };
      return {
        status,
        message: this.flatten(structured.message) ?? exception.message,
        error: structured.error,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaKnown(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid query parameters',
        error: 'Bad Request',
      };
    }

    // Anything else: a generic 500. NEVER surface the real message/stack.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private mapPrismaKnown(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error?: string;
  } {
    switch (exception.code) {
      // Unique constraint violation.
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'A record with these values already exists',
          error: 'Conflict',
        };
      // Foreign-key constraint failed.
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Operation references a record that does not exist',
          error: 'Bad Request',
        };
      // Record required for the operation was not found.
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        };
      default:
        // Unmapped Prisma codes: generic 500, code logged server-side above.
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          error: 'Internal Server Error',
        };
    }
  }

  private flatten(message: unknown): string | undefined {
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    return undefined;
  }
}
