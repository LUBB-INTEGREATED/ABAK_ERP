import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../interfaces/response.interface';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        // WS-D: a file-download route returns a StreamableFile (raw bytes); the
        // {data,timestamp} envelope would JSON-serialise the stream object and
        // ship metadata instead of the file. Pass binary responses through
        // untouched so /documents/:id/download (and /files/:id/download) stream
        // the actual bytes. Same for a Buffer/stream returned directly.
        if (
          data instanceof StreamableFile ||
          Buffer.isBuffer(data) ||
          (data != null &&
            typeof (data as { pipe?: unknown }).pipe === 'function')
        ) {
          return data;
        }
        return { data, timestamp: new Date().toISOString() };
      }),
    );
  }
}
