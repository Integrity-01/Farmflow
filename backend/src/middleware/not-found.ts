import type { Request, Response } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: "We couldn't find that page or resource.",
  });
}