import { Router } from 'express';
import {
  generateInvite,
  getStatus,
  revoke,
  sendMessage,
  webhookEvent,
  webhookHandshake,
} from '../controllers/whatsapp.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { whatsappSendSchema } from '../validations/whatsapp.schema.js';

const whatsappRouter = Router();

whatsappRouter.get('/webhook', webhookHandshake);
whatsappRouter.post('/webhook', webhookEvent);

whatsappRouter.use(requireAuth());

whatsappRouter.get('/status', getStatus);
whatsappRouter.post('/invite', generateInvite);
whatsappRouter.post('/revoke', revoke);
whatsappRouter.post('/send', validate(whatsappSendSchema), sendMessage);

export default whatsappRouter;