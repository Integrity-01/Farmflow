import type { NextFunction, Request, Response } from 'express';
import { expenseService } from '../services/expense.service.js';
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  recordExpensePaymentSchema,
  updateExpenseSchema,
} from '../validations/finance.schema.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listExpensesQuerySchema.parse(req.query);
    res.json(await expenseService.list(req.auth!.user, query));
  } catch (error) {
    next(error);
  }
}

export async function getExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.getById(req.auth!.user, param(req, 'id'));
    res.json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createExpenseSchema.parse(req.body);
    const expense = await expenseService.create(req.auth!.user, input);
    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateExpenseSchema.parse(req.body);
    const expense = await expenseService.update(req.auth!.user, param(req, 'id'), input);
    res.json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    await expenseService.remove(req.auth!.user, param(req, 'id'));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function submitExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.submit(req.auth!.user, param(req, 'id'));
    res.json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function approveExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.approve(req.auth!.user, param(req, 'id'));
    res.json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function rejectExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason: string };
    const expense = await expenseService.reject(req.auth!.user, param(req, 'id'), reason);
    res.json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function cancelExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason: string };
    const expense = await expenseService.cancel(req.auth!.user, param(req, 'id'), reason);
    res.json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function addExpensePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const input = recordExpensePaymentSchema.parse(req.body);
    const expense = await expenseService.addPayment(req.auth!.user, param(req, 'id'), input);
    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
}

export async function listExpensePayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await expenseService.listPayments(req.auth!.user, param(req, 'id'));
    res.json({ payments });
  } catch (error) {
    next(error);
  }
}

export async function listExpenseCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await expenseService.listCategories(req.auth!.user);
    res.json({ categories });
  } catch (error) {
    next(error);
  }
}

export async function createExpenseCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await expenseService.createCategory(req.auth!.user, req.body);
    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
}

export async function updateExpenseCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await expenseService.updateCategory(
      req.auth!.user,
      param(req, 'id'),
      req.body,
    );
    res.json({ category });
  } catch (error) {
    next(error);
  }
}
