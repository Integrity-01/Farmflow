import type { NextFunction, Request, Response } from 'express';
import { farmService } from '../services/farm.service.js';
import { listFarmsQuerySchema } from '../validations/farm.schema.js';

function parseListQuery(req: Request) {
  const parsed = listFarmsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listFarms(_req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListQuery(_req);
    const result = await farmService.list(_req.auth!.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listManagers(_req: Request, res: Response, next: NextFunction) {
  try {
    const managers = await farmService.listManagers();
    res.json({ managers });
  } catch (error) {
    next(error);
  }
}

export async function getFarm(req: Request, res: Response, next: NextFunction) {
  try {
    const farm = await farmService.getById(req.auth!.user, param(req, 'id'));
    res.json({ farm });
  } catch (error) {
    next(error);
  }
}

export async function createFarm(req: Request, res: Response, next: NextFunction) {
  try {
    const farm = await farmService.create(req.auth!.user, req.body);
    res.status(201).json({ farm });
  } catch (error) {
    next(error);
  }
}

export async function updateFarm(req: Request, res: Response, next: NextFunction) {
  try {
    const farm = await farmService.update(req.auth!.user, param(req, 'id'), req.body);
    res.json({ farm });
  } catch (error) {
    next(error);
  }
}

export async function deleteFarm(req: Request, res: Response, next: NextFunction) {
  try {
    await farmService.remove(req.auth!.user, param(req, 'id'));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function listFarmFields(req: Request, res: Response, next: NextFunction) {
  try {
    const fields = await farmService.listFields(req.auth!.user, param(req, 'id'));
    res.json({ fields });
  } catch (error) {
    next(error);
  }
}

export async function addFarmField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await farmService.addField(req.auth!.user, param(req, 'id'), req.body);
    res.status(201).json({ field });
  } catch (error) {
    next(error);
  }
}

export async function updateFarmField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await farmService.updateField(req.auth!.user, param(req, 'fieldId'), req.body);
    res.json({ field });
  } catch (error) {
    next(error);
  }
}

export async function deleteFarmField(req: Request, res: Response, next: NextFunction) {
  try {
    await farmService.removeField(req.auth!.user, param(req, 'fieldId'));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
