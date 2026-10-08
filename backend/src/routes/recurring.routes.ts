import { Router } from 'express';
import {
  activateRecurring,
  createRecurring,
  generateNowRecurring,
  getRecurring,
  listRecurring,
  pauseRecurring,
  removeRecurring,
  skipNextRecurring,
  updateRecurring,
} from '../controllers/recurring.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { recurringTaskSchema, recurringTaskUpdateSchema } from '../validations/recurring.schema.js';

const recurringRouter = Router();

recurringRouter.use(requireAuth());
recurringRouter.use(requireRole('supervisor'));

recurringRouter.get('/', listRecurring);
recurringRouter.post('/', validate(recurringTaskSchema), createRecurring);
recurringRouter.get('/:id', getRecurring);
recurringRouter.patch('/:id', validate(recurringTaskUpdateSchema), updateRecurring);
recurringRouter.delete('/:id', removeRecurring);
recurringRouter.post('/:id/activate', activateRecurring);
recurringRouter.post('/:id/pause', pauseRecurring);
recurringRouter.post('/:id/skip-next', skipNextRecurring);
recurringRouter.post('/:id/generate', generateNowRecurring);

export default recurringRouter;