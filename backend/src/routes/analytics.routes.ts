import { Router } from 'express';
import { getAnalyticsSummary } from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { analyticsQuerySchema } from '../validations/analytics.schema.js';

const analyticsRouter = Router();

analyticsRouter.use(requireAuth(), requireRole('farm_manager'));

analyticsRouter.get('/', validate(analyticsQuerySchema, 'query'), getAnalyticsSummary);

export default analyticsRouter;