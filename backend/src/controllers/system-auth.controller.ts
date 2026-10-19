import type { NextFunction, Request, Response } from 'express';
import {
  SYSTEM_REFRESH_COOKIE_NAME,
  SYSTEM_REFRESH_COOKIE_OPTIONS,
  systemAuthService,
  systemSession,
} from '../services/system-auth.service.js';
import { systemAdminService } from '../services/system-admin.service.js';

function reqMeta(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

function clearSystemCookie(res: Response) {
  res.clearCookie(SYSTEM_REFRESH_COOKIE_NAME, {
    ...SYSTEM_REFRESH_COOKIE_OPTIONS,
    maxAge: undefined,
  });
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await systemAuthService.login(req.body.adminId, req.body.password, reqMeta(req));
    if (result.mfaRequired) {
      res.json({ mfaRequired: true, mfaToken: result.mfaToken });
      return;
    }
    res.cookie(SYSTEM_REFRESH_COOKIE_NAME, result.refreshToken, SYSTEM_REFRESH_COOKIE_OPTIONS);
    res.json({
      mfaRequired: false,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyMfa(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await systemAuthService.verifyMfa(req.body.mfaToken, req.body.code, reqMeta(req));
    res.cookie(SYSTEM_REFRESH_COOKIE_NAME, result.refreshToken, SYSTEM_REFRESH_COOKIE_OPTIONS);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SYSTEM_REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ message: 'Please sign in to continue.', code: 'UNAUTHORIZED' });
      return;
    }
    const result = await systemSession.rotate(token);
    if (!result) {
      clearSystemCookie(res);
      res.status(401).json({
        message: 'Your session has expired. Please sign in again.',
        code: 'UNAUTHORIZED',
      });
      return;
    }
    res.cookie(SYSTEM_REFRESH_COOKIE_NAME, result.refreshToken, SYSTEM_REFRESH_COOKIE_OPTIONS);
    res.json({
      user: { ...result.admin, mfaVerified: result.mfaVerified },
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SYSTEM_REFRESH_COOKIE_NAME] as string | undefined;
    if (token) {
      await systemSession.revokeByToken(token);
    }
    clearSystemCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await systemAuthService.me(
      req.systemAdmin!.admin.id,
      req.systemAdmin!.sessionId,
      req.systemAdmin!.mfaVerified,
    );
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    await systemAuthService.changePassword(
      req.systemAdmin!.admin.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    clearSystemCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function beginMfaEnrollment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await systemAuthService.beginMfaEnrollment(req.systemAdmin!.admin.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmMfaEnrollment(req: Request, res: Response, next: NextFunction) {
  try {
    await systemAuthService.confirmMfaEnrollment(req.systemAdmin!.admin.id, req.body.code);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function disableMfa(req: Request, res: Response, next: NextFunction) {
  try {
    await systemAuthService.disableMfa(req.systemAdmin!.admin.id, req.body.password);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await systemAdminService.updateProfile(req.systemAdmin!.admin.id, {
      name: req.body.name,
      email: req.body.email || null,
    });
    res.json({ user: { ...admin, mfaVerified: req.systemAdmin!.mfaVerified } });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await systemAuthService.forgotPassword(req.body.email);
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
    await systemAuthService.resetPassword(req.body.token, req.body.password);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
