import { Router } from 'express';
import {
  changePassword,
  getNotificationPrefs,
  getProfile,
  updateNotificationPrefs,
  updateProfile,
} from '../controllers/settings.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema,
  updateNotificationPrefsSchema,
  updateProfileSchema,
} from '../validations/settings.schema.js';

const settingsRouter = Router();

settingsRouter.use(requireAuth());

settingsRouter.get('/profile', getProfile);
settingsRouter.patch('/profile', validate(updateProfileSchema), updateProfile);
settingsRouter.get('/notifications', getNotificationPrefs);
settingsRouter.patch('/notifications', validate(updateNotificationPrefsSchema), updateNotificationPrefs);
settingsRouter.post('/change-password', validate(changePasswordSchema), changePassword);

export default settingsRouter;