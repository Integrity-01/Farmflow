import type { NextFunction, Request, Response } from 'express';
import { authService, authSession, REFRESH_COOKIE_OPTIONS } from '../services/auth.service.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.cookie(authSession.REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body.email, req.body.password, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.cookie(authSession.REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[authSession.REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ message: 'Please sign in to continue.', code: 'UNAUTHORIZED' });
      return;
    }

    const result = await authSession.rotate(token);
    if (!result) {
      res.clearCookie(authSession.REFRESH_COOKIE_NAME, {
        ...REFRESH_COOKIE_OPTIONS,
        maxAge: undefined,
      });
      res.status(401).json({ message: 'Your session has expired. Please sign in again.', code: 'UNAUTHORIZED' });
      return;
    }

    res.cookie(authSession.REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[authSession.REFRESH_COOKIE_NAME] as string | undefined;
    if (token) {
      await authSession.revokeSessionByToken(token);
    }
    res.clearCookie(authSession.REFRESH_COOKIE_NAME, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: undefined,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.me(req.auth!.user.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json({
      message: 'If that email is registered, a reset link is on its way.',
      devResetLink: result.devResetLink,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}