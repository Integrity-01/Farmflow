import { Router } from 'express';
import {
  addLabourPayment,
  approveEngagement,
  cancelEngagement,
  createEngagement,
  createLabourer,
  getEngagement,
  getLabourer,
  listEngagements,
  listLabourers,
  listLabourPayments,
  rejectEngagement,
  submitEngagement,
  updateEngagement,
  updateLabourer,
} from '../controllers/labour.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { validate } from '../middleware/validate.js';
import { reasonSchema } from '../validations/finance.schema.js';

const labourRouter = Router();

labourRouter.use(requireAuth());

labourRouter.get('/labourers', requirePermission('labour:view'), listLabourers);
labourRouter.post('/labourers', requirePermission('labour:create'), createLabourer);
labourRouter.get('/labourers/:id', requirePermission('labour:view'), getLabourer);
labourRouter.patch('/labourers/:id', requirePermission('labour:update'), updateLabourer);

labourRouter.get('/engagements', requirePermission('labour:view'), listEngagements);
labourRouter.post('/engagements', requirePermission('labour:create'), createEngagement);
labourRouter.get('/engagements/:id', requirePermission('labour:view'), getEngagement);
labourRouter.patch('/engagements/:id', requirePermission('labour:update'), updateEngagement);
labourRouter.post(
  '/engagements/:id/submit',
  requirePermission('labour:update'),
  submitEngagement,
);
labourRouter.post(
  '/engagements/:id/approve',
  requirePermission('labour:approve'),
  approveEngagement,
);
labourRouter.post(
  '/engagements/:id/reject',
  requirePermission('labour:approve'),
  validate(reasonSchema),
  rejectEngagement,
);
labourRouter.post(
  '/engagements/:id/cancel',
  requirePermission('labour:update'),
  validate(reasonSchema),
  cancelEngagement,
);
labourRouter.get(
  '/engagements/:id/payments',
  requirePermission('labour:view'),
  listLabourPayments,
);
labourRouter.post(
  '/engagements/:id/payments',
  requirePermission('labour:pay'),
  addLabourPayment,
);

export default labourRouter;
