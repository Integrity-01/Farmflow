import { Router } from 'express';
import { listHistory } from '../controllers/history.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { listHistoryQuerySchema } from '../validations/history.schema.js';

const historyRouter = Router();

historyRouter.use(requireAuth(), requireRole('farm_manager'));

historyRouter.get('/', validate(listHistoryQuerySchema, 'query'), listHistory);

export default historyRouter;