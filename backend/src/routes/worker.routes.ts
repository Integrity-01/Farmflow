import { Router } from 'express';
import {
  createWorker,
  deleteWorker,
  getWorker,
  listWorkers,
  updateWorker,
} from '../controllers/worker.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createWorkerSchema, listWorkersQuerySchema, updateWorkerSchema } from '../validations/worker.schema.js';

const workerRouter = Router();

workerRouter.use(requireAuth());

workerRouter.get('/', validate(listWorkersQuerySchema, 'query'), listWorkers);
workerRouter.get('/:id', getWorker);
workerRouter.post('/', requireRole('farm_manager'), validate(createWorkerSchema), createWorker);
workerRouter.patch('/:id', requireRole('farm_manager'), validate(updateWorkerSchema), updateWorker);
workerRouter.delete('/:id', requireRole('farm_manager'), deleteWorker);

export default workerRouter;