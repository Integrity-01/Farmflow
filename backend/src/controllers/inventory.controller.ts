import type { NextFunction, Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service.js';
import { listInputsQuerySchema } from '../validations/inventory.schema.js';

function parseListQuery(req: Request) {
  const parsed = listInputsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listInputs(_req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListQuery(_req);
    const result = await inventoryService.list(_req.auth!.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getInput(req: Request, res: Response, next: NextFunction) {
  try {
    const input = await inventoryService.getById(req.auth!.user, param(req, 'id'));
    res.json({ input });
  } catch (error) {
    next(error);
  }
}

export async function createInput(req: Request, res: Response, next: NextFunction) {
  try {
    const input = await inventoryService.create(req.auth!.user, req.body);
    res.status(201).json({ input });
  } catch (error) {
    next(error);
  }
}

export async function updateInput(req: Request, res: Response, next: NextFunction) {
  try {
    const input = await inventoryService.update(req.auth!.user, param(req, 'id'), req.body);
    res.json({ input });
  } catch (error) {
    next(error);
  }
}

export async function deleteInput(req: Request, res: Response, next: NextFunction) {
  try {
    await inventoryService.remove(req.auth!.user, param(req, 'id'));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function adjustInputStock(req: Request, res: Response, next: NextFunction) {
  try {
    const input = await inventoryService.adjust(req.auth!.user, param(req, 'id'), req.body);
    res.json({ input });
  } catch (error) {
    next(error);
  }
}

export async function listInputMovements(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Math.min(Number(req.query.pageSize) || 10, 100);
    const result = await inventoryService.listMovements(
      req.auth!.user,
      param(req, 'id'),
      { page, pageSize },
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}