import type { NextFunction, Request, Response } from 'express';
import { aiService } from '../services/ai.service.js';

export async function getAiStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(aiService.status());
  } catch (error) {
    next(error);
  }
}

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.chat(req.auth!.user, req.body.message, req.body.history ?? []);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function suggestTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.suggestTasks(req.auth!.user, req.body.farmId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}