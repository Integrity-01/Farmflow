import { Router } from 'express';
import { getVapidPublicKey, subscribe, unsubscribe } from '../controllers/push.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '../validations/push.schema.js';

const pushRouter = Router();

pushRouter.use(requireAuth());

pushRouter.get('/vapid-public-key', getVapidPublicKey);
pushRouter.post('/subscribe', validate(pushSubscribeSchema), subscribe);
pushRouter.post('/unsubscribe', validate(pushUnsubscribeSchema), unsubscribe);

export default pushRouter;