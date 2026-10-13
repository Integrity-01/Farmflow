import { Router } from 'express';
import aiRoutes from './ai.routes.js';
import analyticsRoutes from './analytics.routes.js';
import authRoutes from './auth.routes.js';
import farmRoutes from './farm.routes.js';
import healthRoutes from './health.routes.js';
import historyRoutes from './history.routes.js';
import inventoryRoutes from './inventory.routes.js';
import notificationRoutes from './notification.routes.js';
import pushRoutes from './push.routes.js';
import recurringRoutes from './recurring.routes.js';
import reportRoutes from './report.routes.js';
import settingsRoutes from './settings.routes.js';
import { categoryRouter, taskRouter } from './task.routes.js';
import workerRoutes from './worker.routes.js';
import weatherRoutes from './weather.routes.js';
import orgRouter from './organization.routes.js';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    name: 'FarmFlow API',
    version: '0.1.0',
    status: 'running',
  });
});

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/farms', farmRoutes);
router.use('/workers', workerRoutes);
router.use('/tasks', taskRouter);
router.use('/categories', categoryRouter);
router.use('/notifications', notificationRoutes);
router.use('/push', pushRoutes);
router.use('/recurring-tasks', recurringRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportRoutes);
router.use('/history', historyRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/weather', weatherRoutes);
router.use('/organizations', orgRouter);
router.use('/ai', aiRoutes);
router.use('/settings', settingsRoutes);

export default router;