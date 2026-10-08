import type { NextFunction, Request, Response } from 'express';
import { reportService, type ReportFilters } from '../services/report.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listReports(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reportService.list(req.auth!.user, {
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 10),
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function createReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportService.create(req.auth!.user, {
      reportType: req.body.reportType,
      format: req.body.format ?? 'csv',
      filters: req.body.filters as ReportFilters | undefined,
    });
    res.status(201).json({ status: 'success', data: report });
  } catch (error) {
    next(error);
  }
}

export async function deleteReport(req: Request, res: Response, next: NextFunction) {
  try {
    await reportService.remove(req.auth!.user, param(req, 'id'));
    res.json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
}