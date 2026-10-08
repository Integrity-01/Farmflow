import type { NextFunction, Request, Response } from 'express';
import { weatherService } from '../services/weather.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function getWeather(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await weatherService.getWeather(req.auth!.user, param(req, 'farmId'));
    res.json(result);
  } catch (error) {
    next(error);
  }
}