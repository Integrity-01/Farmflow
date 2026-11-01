import { Router } from 'express';
import {
  addChemicalMovement,
  cancelChemicalUsage,
  chemicalAlerts,
  createChemical,
  deleteChemical,
  getChemical,
  listChemicalMovements,
  listChemicalUsage,
  listChemicals,
  recordChemicalUsage,
  updateChemical,
} from '../controllers/chemical.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { validate } from '../middleware/validate.js';
import { reasonSchema } from '../validations/finance.schema.js';

const chemicalRouter = Router();

chemicalRouter.use(requireAuth());

chemicalRouter.get('/usage', requirePermission('chemical:view'), listChemicalUsage);
chemicalRouter.post('/usage', requirePermission('chemical:use'), recordChemicalUsage);
chemicalRouter.post(
  '/usage/:id/cancel',
  requirePermission('chemical:use'),
  validate(reasonSchema),
  cancelChemicalUsage,
);
chemicalRouter.get('/alerts', requirePermission('chemical:view'), chemicalAlerts);

chemicalRouter.get('/', requirePermission('chemical:view'), listChemicals);
chemicalRouter.post('/', requirePermission('chemical:create'), createChemical);
chemicalRouter.get('/:id', requirePermission('chemical:view'), getChemical);
chemicalRouter.patch('/:id', requirePermission('chemical:update'), updateChemical);
chemicalRouter.delete('/:id', requirePermission('chemical:delete'), deleteChemical);
chemicalRouter.get('/:id/movements', requirePermission('chemical:view'), listChemicalMovements);
chemicalRouter.post(
  '/:id/movements',
  requirePermission('chemical:adjust'),
  addChemicalMovement,
);

export default chemicalRouter;
