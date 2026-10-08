import type { NextFunction, Request, Response } from 'express';
import { historyService } from '../services/history.service.js';

export async function listHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await historyService.list(req.auth!.user, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      farmId: typeof req.query.farmId === 'string' ? req.query.farmId : undefined,
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 20),
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}