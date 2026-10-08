import type { NextFunction, Request, Response } from 'express';
import { workerService } from '../services/worker.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listWorkers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await workerService.list(req.auth!.user, {
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      farmId: req.query.farmId as string | undefined,
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 10),
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const worker = await workerService.get(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: worker });
  } catch (error) {
    next(error);
  }
}

export async function createWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const worker = await workerService.create(req.auth!.user, req.body);
    res.status(201).json({ status: 'success', data: worker });
  } catch (error) {
    next(error);
  }
}

export async function updateWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const worker = await workerService.update(req.auth!.user, param(req, 'id'), req.body);
    res.json({ status: 'success', data: worker });
  } catch (error) {
    next(error);
  }
}

export async function deleteWorker(req: Request, res: Response, next: NextFunction) {
  try {
    await workerService.remove(req.auth!.user, param(req, 'id'));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}