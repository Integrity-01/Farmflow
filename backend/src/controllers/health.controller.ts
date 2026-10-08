import type { Request, Response } from 'express';
import { getHealth } from '../services/health.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const healthController = {
  check: asyncHandler(async (_req: Request, res: Response) => {
    const health = await getHealth();
    res.status(200).json(health);
  }),
};