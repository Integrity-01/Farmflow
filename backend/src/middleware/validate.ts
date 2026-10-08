import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

export function validate(schema: ZodType, where: 'body' | 'query' = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const source = where === 'body' ? req.body : req.query;
    const result = schema.safeParse(source);

    if (!result.success) {
      next(result.error);
      return;
    }

    if (where === 'body') {
      req.body = result.data;
    } else {
      Object.defineProperty(req, 'query', {
        value: result.data,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
    next();
  };
}