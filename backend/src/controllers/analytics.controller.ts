import type { NextFunction, Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service.js';

export async function getAnalyticsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await analyticsService.summary(req.auth!.user, {
      rangeDays: Number(req.query.rangeDays ?? 30),
    });
    res.json({ status: 'success', data: summary });
  } catch (error) {
    next(error);
  }
}