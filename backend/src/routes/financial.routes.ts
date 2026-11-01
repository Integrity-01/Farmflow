import { Router } from 'express';
import {
  exportReport,
  getCostAnalysis,
  getOverview,
  listBudgets,
  upsertBudget,
} from '../controllers/financial.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';

const financialRouter = Router();

financialRouter.use(requireAuth());

financialRouter.get('/overview', requirePermission('finance:view'), getOverview);
financialRouter.get('/cost-analysis', requirePermission('finance:view'), getCostAnalysis);
financialRouter.get('/budgets', requirePermission('finance:view'), listBudgets);
financialRouter.put('/budgets', requirePermission('finance:view'), upsertBudget);
financialRouter.get('/export/:type', requirePermission('finance:report'), exportReport);

export default financialRouter;
