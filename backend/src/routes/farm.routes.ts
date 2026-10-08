import { Router } from 'express';
import {
  addFarmField,
  createFarm,
  deleteFarm,
  deleteFarmField,
  getFarm,
  listFarmFields,
  listFarms,
  listManagers,
  updateFarm,
  updateFarmField,
} from '../controllers/farm.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createFarmSchema,
  createFieldSchema,
  updateFarmSchema,
  updateFieldSchema,
} from '../validations/farm.schema.js';

const farmRouter = Router();

farmRouter.use(requireAuth());

farmRouter.get('/managers', requireRole('farm_manager'), listManagers);
farmRouter.get('/', listFarms);
farmRouter.post('/', requireRole('farm_manager'), validate(createFarmSchema), createFarm);

farmRouter.patch('/fields/:fieldId', requireRole('farm_manager'), validate(updateFieldSchema), updateFarmField);
farmRouter.delete('/fields/:fieldId', requireRole('farm_manager'), deleteFarmField);

farmRouter.get('/:id/fields', listFarmFields);
farmRouter.post('/:id/fields', requireRole('farm_manager'), validate(createFieldSchema), addFarmField);
farmRouter.get('/:id', getFarm);
farmRouter.patch('/:id', requireRole('farm_manager'), validate(updateFarmSchema), updateFarm);
farmRouter.delete('/:id', requireRole('farm_manager'), deleteFarm);

export default farmRouter;