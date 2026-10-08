import type { NextFunction, Request, Response } from 'express';
import { taskService } from '../services/task.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await taskService.list(req.auth!.user, {
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      farmId: req.query.farmId as string | undefined,
      fieldId: req.query.fieldId as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      assignedTo: req.query.assignedTo as string | undefined,
      mine: req.query.mine === 'true',
      overdue: req.query.overdue === 'true',
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 10),
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.get(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: task });
  } catch (error) {
    next(error);
  }
}

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await taskService.categories();
    res.json({ status: 'success', data: categories });
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.create(req.auth!.user, req.body);
    res.status(201).json({ status: 'success', data: task });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.update(req.auth!.user, param(req, 'id'), req.body);
    res.json({ status: 'success', data: task });
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    await taskService.remove(req.auth!.user, param(req, 'id'));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function startTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.start(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: task });
  } catch (error) {
    next(error);
  }
}

export async function completeTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.complete(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: task });
  } catch (error) {
    next(error);
  }
}

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    const comment = await taskService.addComment(req.auth!.user, param(req, 'id'), req.body.body);
    res.status(201).json({ status: 'success', data: comment });
  } catch (error) {
    next(error);
  }
}

export async function addAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      const error = new Error('Please choose a file to upload.');
      (error as { status?: number }).status = 400;
      throw error;
    }
    const attachment = await taskService.addAttachment(req.auth!.user, param(req, 'id'), {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storageKey: req.file.filename,
    });
    res.status(201).json({ status: 'success', data: attachment });
  } catch (error) {
    next(error);
  }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    await taskService.removeAttachment(req.auth!.user, param(req, 'id'));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}