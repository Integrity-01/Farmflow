import type { NextFunction, Request, Response } from 'express';
import { recurringService, type RecurringInput } from '../services/recurring.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listRecurring(_req: Request, res: Response, next: NextFunction) {
  try {
    const rules = await recurringService.list();
    res.json({ status: 'success', data: rules });
  } catch (error) {
    next(error);
  }
}

export async function getRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await recurringService.get(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
}

export async function createRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await recurringService.create(req.auth!.user, req.body as RecurringInput);
    res.status(201).json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
}

export async function updateRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await recurringService.update(req.auth!.user, param(req, 'id'), req.body as Partial<RecurringInput>);
    res.json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
}

export async function removeRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    await recurringService.remove(req.auth!.user, param(req, 'id'));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function activateRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await recurringService.setActive(req.auth!.user, param(req, 'id'), true);
    res.json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
}

export async function pauseRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await recurringService.setActive(req.auth!.user, param(req, 'id'), false);
    res.json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
}

export async function skipNextRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await recurringService.skipNext(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
}

export async function generateNowRecurring(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await recurringService.generateNow(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}