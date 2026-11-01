import type { NextFunction, Request, Response } from 'express';
import { chemicalService } from '../services/chemical.service.js';
import {
  chemicalMovementSchema,
  chemicalUsageSchema,
  createChemicalSchema,
  listChemicalUsageQuerySchema,
  listChemicalsQuerySchema,
  updateChemicalSchema,
} from '../validations/finance.schema.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listChemicals(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listChemicalsQuerySchema.parse(req.query);
    res.json(await chemicalService.list(req.auth!.user, query));
  } catch (error) {
    next(error);
  }
}

export async function getChemical(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await chemicalService.getById(req.auth!.user, param(req, 'id'));
    res.json({ product });
  } catch (error) {
    next(error);
  }
}

export async function createChemical(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createChemicalSchema.parse(req.body);
    const product = await chemicalService.create(req.auth!.user, input);
    res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
}

export async function updateChemical(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateChemicalSchema.parse(req.body);
    const product = await chemicalService.update(req.auth!.user, param(req, 'id'), input);
    res.json({ product });
  } catch (error) {
    next(error);
  }
}

export async function deleteChemical(req: Request, res: Response, next: NextFunction) {
  try {
    await chemicalService.remove(req.auth!.user, param(req, 'id'));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function addChemicalMovement(req: Request, res: Response, next: NextFunction) {
  try {
    const input = chemicalMovementSchema.parse(req.body);
    const product = await chemicalService.addMovement(
      req.auth!.user,
      param(req, 'id'),
      input,
    );
    res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
}

export async function listChemicalMovements(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await chemicalService.getById(req.auth!.user, param(req, 'id'));
    res.json({ movements: product.movements });
  } catch (error) {
    next(error);
  }
}

export async function listChemicalUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listChemicalUsageQuerySchema.parse(req.query);
    res.json(await chemicalService.listUsage(req.auth!.user, query));
  } catch (error) {
    next(error);
  }
}

export async function recordChemicalUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const input = chemicalUsageSchema.parse(req.body);
    const usage = await chemicalService.recordUsage(req.auth!.user, input);
    res.status(201).json({ usage });
  } catch (error) {
    next(error);
  }
}

export async function cancelChemicalUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason: string };
    const usage = await chemicalService.cancelUsage(
      req.auth!.user,
      param(req, 'id'),
      reason,
    );
    res.json({ usage });
  } catch (error) {
    next(error);
  }
}

export async function chemicalAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await chemicalService.alerts(req.auth!.user);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
}
