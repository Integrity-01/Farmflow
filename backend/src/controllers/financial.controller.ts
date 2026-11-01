import type { NextFunction, Request, Response } from 'express';
import { financialService } from '../services/financial.service.js';
import {
  costAnalysisQuerySchema,
  financialExportQuerySchema,
  financialOverviewQuerySchema,
  upsertBudgetSchema,
} from '../validations/finance.schema.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const query = financialOverviewQuerySchema.parse(req.query);
    res.json(await financialService.overview(req.auth!.user, query));
  } catch (error) {
    next(error);
  }
}

export async function getCostAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const query = costAnalysisQuerySchema.parse(req.query);
    res.json(await financialService.costAnalysis(req.auth!.user, query));
  } catch (error) {
    next(error);
  }
}

export async function listBudgets(req: Request, res: Response, next: NextFunction) {
  try {
    const query = financialOverviewQuerySchema.parse(req.query);
    const budgets = await financialService.listBudgets(req.auth!.user, query);
    res.json({ budgets });
  } catch (error) {
    next(error);
  }
}

export async function upsertBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const input = upsertBudgetSchema.parse(req.body);
    const budget = await financialService.upsertBudget(req.auth!.user, input);
    res.status(201).json({ budget });
  } catch (error) {
    next(error);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query = financialExportQuerySchema.parse(req.query);
    const { filename, csv } = await financialService.export(
      req.auth!.user,
      param(req, 'type'),
      query,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
}
