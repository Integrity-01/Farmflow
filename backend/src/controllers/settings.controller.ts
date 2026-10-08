import type { NextFunction, Request, Response } from 'express';
import { settingsService, type NotificationPrefs } from '../services/settings.service.js';

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await settingsService.getProfile(req.auth!.user.id);
    res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await settingsService.updateProfile(req.auth!.user.id, {
      name: req.body.name,
      phone: req.body.phone,
    });
    res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
}

export async function getNotificationPrefs(_req: Request, res: Response, next: NextFunction) {
  try {
    const prefs = await settingsService.getNotificationPrefs(_req.auth!.user.id);
    res.json({ status: 'success', data: prefs });
  } catch (error) {
    next(error);
  }
}

export async function updateNotificationPrefs(req: Request, res: Response, next: NextFunction) {
  try {
    const prefs = await settingsService.updateNotificationPrefs(
      req.auth!.user.id,
      req.body as Partial<NotificationPrefs>,
    );
    res.json({ status: 'success', data: prefs });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    await settingsService.changePassword(
      req.auth!.user.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
}