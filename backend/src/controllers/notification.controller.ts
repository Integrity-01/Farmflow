import type { NextFunction, Request, Response } from 'express';
import { notificationService } from '../services/notification.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await notificationService.list(req.auth!.user, {
      unreadOnly: req.query.unreadOnly === 'true',
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 20),
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(_req: Request, res: Response, next: NextFunction) {
  try {
    const count = await notificationService.unreadCount(_req.auth!.user);
    res.json({ status: 'success', data: { count } });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const notification = await notificationService.markRead(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: notification });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(_req: Request, res: Response, next: NextFunction) {
  try {
    const count = await notificationService.markAllRead(_req.auth!.user);
    res.json({ status: 'success', data: { count } });
  } catch (error) {
    next(error);
  }
}