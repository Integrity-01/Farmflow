import type { NextFunction, Request, Response } from 'express';
import { pushService } from '../services/push.service.js';

export function getVapidPublicKey(_req: Request, res: Response) {
  res.json({ status: 'success', data: { publicKey: pushService.getVapidPublicKey() } });
}

export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
    const result = await pushService.subscribe(
      req.auth!.user.id,
      { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      req.get('user-agent') ?? null,
    );
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function unsubscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pushService.unsubscribe(
      req.auth!.user.id,
      (req.body as { endpoint?: string })?.endpoint ?? '',
    );
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}