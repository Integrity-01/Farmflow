import type { NextFunction, Request, Response } from 'express';
import { labourService } from '../services/labour.service.js';
import {
  createLabourEngagementSchema,
  createLabourerSchema,
  listLabourEngagementsQuerySchema,
  listLabourersQuerySchema,
  recordLabourPaymentSchema,
  updateLabourEngagementSchema,
  updateLabourerSchema,
} from '../validations/finance.schema.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listLabourers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listLabourersQuerySchema.parse(req.query);
    res.json(await labourService.listLabourers(req.auth!.user, query));
  } catch (error) {
    next(error);
  }
}

export async function getLabourer(req: Request, res: Response, next: NextFunction) {
  try {
    const labourer = await labourService.getLabourer(req.auth!.user, param(req, 'id'));
    res.json({ labourer });
  } catch (error) {
    next(error);
  }
}

export async function createLabourer(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createLabourerSchema.parse(req.body);
    const labourer = await labourService.createLabourer(req.auth!.user, input);
    res.status(201).json({ labourer });
  } catch (error) {
    next(error);
  }
}

export async function updateLabourer(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateLabourerSchema.parse(req.body);
    const labourer = await labourService.updateLabourer(
      req.auth!.user,
      param(req, 'id'),
      input,
    );
    res.json({ labourer });
  } catch (error) {
    next(error);
  }
}

export async function listEngagements(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listLabourEngagementsQuerySchema.parse(req.query);
    res.json(await labourService.listEngagements(req.auth!.user, query));
  } catch (error) {
    next(error);
  }
}

export async function getEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const engagement = await labourService.getEngagement(req.auth!.user, param(req, 'id'));
    res.json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function createEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createLabourEngagementSchema.parse(req.body);
    const engagement = await labourService.createEngagement(req.auth!.user, input);
    res.status(201).json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function updateEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateLabourEngagementSchema.parse(req.body);
    const engagement = await labourService.updateEngagement(
      req.auth!.user,
      param(req, 'id'),
      input,
    );
    res.json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function submitEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const engagement = await labourService.submit(req.auth!.user, param(req, 'id'));
    res.json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function approveEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const engagement = await labourService.approve(req.auth!.user, param(req, 'id'));
    res.json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function rejectEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason: string };
    const engagement = await labourService.reject(req.auth!.user, param(req, 'id'), reason);
    res.json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function cancelEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason: string };
    const engagement = await labourService.cancel(req.auth!.user, param(req, 'id'), reason);
    res.json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function addLabourPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const input = recordLabourPaymentSchema.parse(req.body);
    const engagement = await labourService.addPayment(
      req.auth!.user,
      param(req, 'id'),
      input,
    );
    res.status(201).json({ engagement });
  } catch (error) {
    next(error);
  }
}

export async function listLabourPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await labourService.listPayments(req.auth!.user, param(req, 'id'));
    res.json({ payments });
  } catch (error) {
    next(error);
  }
}
