import { Router } from 'express';
import { getWeather } from '../controllers/weather.controller.js';
import { requireAuth } from '../middleware/auth.js';

const weatherRouter = Router();

weatherRouter.use(requireAuth());

weatherRouter.get('/:farmId', getWeather);

export default weatherRouter;