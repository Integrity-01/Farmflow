import type { NextFunction, Request, Response } from 'express';
import { whatsappService, whatsappConfigured } from '../services/whatsapp.service.js';
import { AppError } from '../utils/AppError.js';

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await whatsappService.getStatus(req.auth!.user.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function generateInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await whatsappService.generateInvite(req.auth!.user.id);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    await whatsappService.revoke(req.auth!.user.id);
    res.json({ status: 'success', data: { revoked: true } });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await whatsappService.send(
      req.auth!.user.id,
      (req.body as { to: string }).to,
      (req.body as { message: string }).message,
    );
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export function webhookHandshake(req: Request, res: Response, next: NextFunction) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (
      typeof mode === 'string' &&
      typeof token === 'string' &&
      whatsappService.verifyHandshake({ mode, token })
    ) {
      if (typeof challenge === 'string') {
        res.type('text/plain').send(challenge);
        return;
      }
    }
    throw new AppError(403, 'Webhook verification failed.', 'VERIFY_TOKEN_MISMATCH');
  } catch (error) {
    next(error);
  }
}

export async function webhookEvent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!whatsappConfigured) {
      throw new AppError(503, 'WhatsApp is not configured.', 'WHATSAPP_NOT_CONFIGURED');
    }
    const raw = (req as { rawBody?: Buffer }).rawBody;
    if (!raw || !whatsappService.verifySignature(raw, req.get('x-hub-signature-256'))) {
      throw new AppError(401, 'Invalid signature.', 'INVALID_WEBHOOK_SIGNATURE');
    }

    const payload = req.body as {
      entry?: {
        changes?: {
          value?: {
            messages?: {
              from: string;
              id: string;
              text?: { body?: string };
            }[];
            contacts?: { profile?: { name?: string }; wa_id?: string }[];
          };
        }[];
      }[];
    };

    const outputs = await whatsappService.handleInbound({
      changes: payload.entry?.flatMap((entry) => entry.changes ?? []),
    });

    for (const output of outputs) {
      for (const reply of output.replies) {
        // Inbound messages open a 24h customer-service window, so replies are
        // always free-form text.
        try {
          await whatsappService.sendReply(output.phone, reply);
        } catch (error) {
          // Surface single-reply failures without breaking the webhook ack.
          console.error('[whatsapp] Reply failed', (error as Error).message);
        }
      }
    }

    res.json({ status: 'success' });
  } catch (error) {
    next(error);
  }
}