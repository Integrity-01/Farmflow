import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  beginMfaEnrollment,
  changePassword,
  confirmMfaEnrollment,
  disableMfa,
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  resetPassword,
  updateProfile,
  verifyMfa,
} from '../controllers/system-auth.controller.js';
import {
  activateOrganization,
  analytics,
  auditLogs,
  createAdministrator,
  getOrganization,
  getUser,
  listAdministrators,
  listOrganizations,
  listUsers,
  overview,
  platformHealth,
  resetAdministratorPassword,
  setAdministratorStatus,
  suspendOrganization,
} from '../controllers/system.controller.js';
import { requireSystemAdmin, requireSystemOwner } from '../middleware/system-auth.js';
import { validate } from '../middleware/validate.js';
import {
  systemAdminStatusSchema,
  systemAnalyticsQuerySchema,
  systemAuditQuerySchema,
  systemChangePasswordSchema,
  systemConfirmMfaSchema,
  systemCreateAdminSchema,
  systemDisableMfaSchema,
  systemForgotPasswordSchema,
  systemLoginSchema,
  systemOrganizationsQuerySchema,
  systemResetPasswordSchema,
  systemUpdateProfileSchema,
  systemUsersQuerySchema,
  systemVerifyMfaSchema,
} from '../validations/system.schema.js';

const systemRouter = Router();

// A stricter limiter than the tenant login: platform access is high-value.
const systemLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMITED',
    message: 'Too many attempts. Please wait a few minutes and try again.',
  },
});

const systemForgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMITED',
    message: 'Too many reset requests. Please try again later.',
  },
});

// ---- Auth (public) ----
systemRouter.post('/auth/login', systemLoginLimiter, validate(systemLoginSchema), login);
systemRouter.post('/auth/verify-mfa', systemLoginLimiter, validate(systemVerifyMfaSchema), verifyMfa);
systemRouter.post('/auth/refresh', refresh);
systemRouter.post('/auth/logout', logout);
systemRouter.post(
  '/auth/forgot-password',
  systemForgotLimiter,
  validate(systemForgotPasswordSchema),
  forgotPassword,
);
systemRouter.post('/auth/reset-password', validate(systemResetPasswordSchema), resetPassword);

// ---- Auth (authenticated) ----
systemRouter.get('/auth/me', requireSystemAdmin(), me);
systemRouter.post(
  '/auth/change-password',
  requireSystemAdmin(),
  validate(systemChangePasswordSchema),
  changePassword,
);
systemRouter.patch(
  '/auth/profile',
  requireSystemAdmin(),
  validate(systemUpdateProfileSchema),
  updateProfile,
);
systemRouter.post('/auth/mfa/enroll', requireSystemAdmin(), beginMfaEnrollment);
systemRouter.post(
  '/auth/mfa/confirm',
  requireSystemAdmin(),
  validate(systemConfirmMfaSchema),
  confirmMfaEnrollment,
);
systemRouter.post(
  '/auth/mfa/disable',
  requireSystemAdmin(),
  validate(systemDisableMfaSchema),
  disableMfa,
);

// ---- Platform data (authenticated) ----
systemRouter.get('/overview', requireSystemAdmin(), overview);
systemRouter.get(
  '/organizations',
  requireSystemAdmin(),
  validate(systemOrganizationsQuerySchema, 'query'),
  listOrganizations,
);
systemRouter.get('/organizations/:id', requireSystemAdmin(), getOrganization);
systemRouter.post('/organizations/:id/suspend', requireSystemAdmin(), suspendOrganization);
systemRouter.post('/organizations/:id/activate', requireSystemAdmin(), activateOrganization);
systemRouter.get('/users', requireSystemAdmin(), validate(systemUsersQuerySchema, 'query'), listUsers);
systemRouter.get('/users/:id', requireSystemAdmin(), getUser);
systemRouter.get('/analytics', requireSystemAdmin(), validate(systemAnalyticsQuerySchema, 'query'), analytics);
systemRouter.get('/audit-logs', requireSystemAdmin(), validate(systemAuditQuerySchema, 'query'), auditLogs);
systemRouter.get('/health', requireSystemAdmin(), platformHealth);

// ---- Administrator management (owner only) ----
systemRouter.get('/administrators', requireSystemAdmin(), listAdministrators);
systemRouter.post(
  '/administrators',
  requireSystemAdmin(),
  requireSystemOwner(),
  validate(systemCreateAdminSchema),
  createAdministrator,
);
systemRouter.patch(
  '/administrators/:id/status',
  requireSystemAdmin(),
  requireSystemOwner(),
  validate(systemAdminStatusSchema),
  setAdministratorStatus,
);
systemRouter.post(
  '/administrators/:id/reset-password',
  requireSystemAdmin(),
  requireSystemOwner(),
  resetAdministratorPassword,
);

export default systemRouter;
