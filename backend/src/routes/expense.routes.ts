import { Router } from 'express';
import {
  addExpensePayment,
  approveExpense,
  cancelExpense,
  createExpense,
  createExpenseCategory,
  deleteExpense,
  getExpense,
  listExpenseCategories,
  listExpensePayments,
  listExpenses,
  rejectExpense,
  submitExpense,
  updateExpense,
  updateExpenseCategory,
} from '../controllers/expense.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { validate } from '../middleware/validate.js';
import {
  createExpenseCategorySchema,
  reasonSchema,
  updateExpenseCategorySchema,
} from '../validations/finance.schema.js';

const expenseRouter = Router();

expenseRouter.use(requireAuth());

expenseRouter.get('/categories', requirePermission('expense:view'), listExpenseCategories);
expenseRouter.post(
  '/categories',
  requirePermission('org:update'),
  validate(createExpenseCategorySchema),
  createExpenseCategory,
);
expenseRouter.patch(
  '/categories/:id',
  requirePermission('org:update'),
  validate(updateExpenseCategorySchema),
  updateExpenseCategory,
);

expenseRouter.get('/', requirePermission('expense:view'), listExpenses);
expenseRouter.post('/', requirePermission('expense:create'), createExpense);
expenseRouter.get('/:id', requirePermission('expense:view'), getExpense);
expenseRouter.patch('/:id', requirePermission('expense:update'), updateExpense);
expenseRouter.delete('/:id', requirePermission('expense:delete'), deleteExpense);
expenseRouter.post('/:id/submit', requirePermission('expense:update'), submitExpense);
expenseRouter.post('/:id/approve', requirePermission('expense:approve'), approveExpense);
expenseRouter.post(
  '/:id/reject',
  requirePermission('expense:approve'),
  validate(reasonSchema),
  rejectExpense,
);
expenseRouter.post(
  '/:id/cancel',
  requirePermission('expense:update'),
  validate(reasonSchema),
  cancelExpense,
);
expenseRouter.get('/:id/payments', requirePermission('expense:view'), listExpensePayments);
expenseRouter.post('/:id/payments', requirePermission('expense:pay'), addExpensePayment);

export default expenseRouter;
