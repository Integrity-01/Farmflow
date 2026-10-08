import { Router } from 'express';
import { chat, getAiStatus, suggestTasks } from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { chatSchema, suggestSchema } from '../validations/ai.schema.js';

const aiRouter = Router();

aiRouter.use(requireAuth());
aiRouter.use(requireRole('farm_manager'));

aiRouter.get('/status', getAiStatus);
aiRouter.post('/chat', validate(chatSchema), chat);
aiRouter.post('/suggest', validate(suggestSchema), suggestTasks);

export default aiRouter;