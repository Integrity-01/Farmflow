import { Router } from 'express';
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markNotificationRead,
} from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth());

notificationRouter.get('/', listNotifications);
notificationRouter.get('/unread-count', getUnreadCount);
notificationRouter.post('/read-all', markAllRead);
notificationRouter.patch('/:id/read', markNotificationRead);

export default notificationRouter;