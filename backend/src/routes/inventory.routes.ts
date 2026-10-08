import { Router } from 'express';
import {
  adjustInputStock,
  createInput,
  deleteInput,
  getInput,
  listInputMovements,
  listInputs,
  updateInput,
} from '../controllers/inventory.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  adjustInputSchema,
  createInputSchema,
  updateInputSchema,
} from '../validations/inventory.schema.js';

const inventoryRouter = Router();

inventoryRouter.use(requireAuth());

inventoryRouter.get('/', listInputs);
inventoryRouter.post('/', requireRole('farm_manager'), validate(createInputSchema), createInput);

inventoryRouter.get('/:id/movements', listInputMovements);
inventoryRouter.post('/:id/adjust', requireRole('farm_manager'), validate(adjustInputSchema), adjustInputStock);
inventoryRouter.get('/:id', getInput);
inventoryRouter.patch('/:id', requireRole('farm_manager'), validate(updateInputSchema), updateInput);
inventoryRouter.delete('/:id', requireRole('farm_manager'), deleteInput);

export default inventoryRouter;