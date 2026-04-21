import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    locale?: string;
  }
}

const SUPPORTED = ['ar', 'en'];

function pickLocale(header: string | undefined): string {
  if (!header) return 'ar';
  const candidate = header.split(',')[0]?.trim().toLowerCase() ?? 'ar';
  const base = candidate.split('-')[0];
  return SUPPORTED.includes(base) ? base : 'ar';
}

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const explicit =
      (req.headers['x-locale'] as string | undefined) ??
      (req.query?.locale as string | undefined);
    req.locale = explicit
      ? pickLocale(explicit)
      : pickLocale(req.headers['accept-language']);
    next();
  }
}
