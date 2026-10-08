import { Router } from 'express';
import { createReport, deleteReport, listReports } from '../controllers/report.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createReportSchema, listReportsQuerySchema } from '../validations/report.schema.js';

const reportRouter = Router();

reportRouter.use(requireAuth(), requireRole('farm_manager'));

reportRouter.get('/', validate(listReportsQuerySchema, 'query'), listReports);
reportRouter.post('/', validate(createReportSchema), createReport);
reportRouter.delete('/:id', deleteReport);

export default reportRouter;