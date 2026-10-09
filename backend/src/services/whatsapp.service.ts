import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { pool, uid } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import { weatherService } from './weather.service.js';

/**
 * WhatsApp-first channel: phone links (invite-code reply binding), inbound
 * assistant, outbound alerts. Degrades gracefully to "not configured" until
 * WHATSAPP_TOKEN / WHATSAPP_PHONE_ID / WHATSAPP_VERIFY_TOKEN /
 * WHATSAPP_WEBHOOK_SECRET are present - mirrors the push/VAPID behaviour.
 */

export const whatsappConfigured = Boolean(
  env.WHATSAPP_TOKEN &&
    env.WHATSAPP_PHONE_ID &&
    env.WHATSAPP_VERIFY_TOKEN &&
    env.WHATSAPP_WEBHOOK_SECRET,
);

const GRAPH_BASE = () =>
  `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_ID}`;

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WhatsAppSendInput {
  title: string;
  message: string;
  type: string;
  taskId: string | null;
}

interface PrefsRow {
  whatsapp_enabled: boolean;
  task_assignments: boolean;
  deadline_reminders: boolean;
  overdue_alerts: boolean;
  task_completions: boolean;
  daily_summary: boolean;
}

const DEFAULT_PREFS: PrefsRow = {
  whatsapp_enabled: false,
  task_assignments: true,
  deadline_reminders: true,
  overdue_alerts: true,
  task_completions: true,
  daily_summary: false,
};

const TYPE_PREF: Record<string, keyof PrefsRow> = {
  task_assigned: 'task_assignments',
  task_due_soon: 'deadline_reminders',
  task_overdue: 'overdue_alerts',
  task_completed: 'task_completions',
  daily_summary: 'daily_summary',
};

interface LinkRow {
  id: string;
  user_id: string;
  whatsapp_number: string | null;
  wa_name: string | null;
  invite_code: string;
  status: 'invited' | 'active' | 'revoked';
  last_session_at: Date | string | null;
}

function toShortDate(value: Date | string | null | undefined): string {
  if (!value) return 'no deadline';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'no deadline';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function parseDate(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function inSession(link: LinkRow): boolean {
  const last = parseDate(link.last_session_at);
  if (!last) return false;
  return Date.now() - last < SESSION_WINDOW_MS;
}

function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  while (code.length < 8) {
    code += alphabet[randomBytes(1)[0] % alphabet.length];
  }
  return code;
}

async function graphRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${GRAPH_BASE()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { error?: { message?: string; type?: string; code?: number } };
  if (!response.ok) {
    throw new Error(data.error?.message ?? `WhatsApp API responded ${response.status}`);
  }
  return data;
}

async function sendText(to: string, body: string): Promise<{ id: string }> {
  const data = (await graphRequest('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body },
  })) as { messages?: { id?: string }[] };
  return { id: data.messages?.[0]?.id ?? '' };
}

/** Public wrapper for webhook replies (inbound opens a free-form window). */
async function sendReply(to: string, body: string): Promise<{ id: string }> {
  ensureConfigured();
  return sendText(to, body);
}

function ensureConfigured(): void {
  if (!whatsappConfigured) {
    throw new AppError(503, 'WhatsApp is not configured yet.', 'WHATSAPP_NOT_CONFIGURED');
  }
}

async function sendTemplate(to: string, body: string): Promise<{ id: string }> {
  const data = (await graphRequest('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: env.WHATSAPP_ALERT_TEMPLATE,
      language: { code: 'en' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: body }] }],
    },
  })) as { messages?: { id?: string }[] };
  return { id: data.messages?.[0]?.id ?? '' };
}

async function sendTextOrTemplate(link: LinkRow, body: string): Promise<{ id: string }> {
  const to = link.whatsapp_number!;
  if (inSession(link)) {
    return sendText(to, body);
  }
  // Business-initiated without an open 24h customer-service session requires
  // an approved template. Fall back to a plain text attempt on template error.
  try {
    return await sendTemplate(to, body);
  } catch (error) {
    logger.warn('[whatsapp] Template send failed, trying free-form', {
      message: (error as Error).message,
    });
    return sendText(to, body);
  }
}

function accessibleFarmsSql() {
  return `(SELECT farm_id FROM farms WHERE manager_id = $1
           UNION
           SELECT farm_id FROM workers WHERE user_id = $1)`;
}

interface WeatherBriefData {
  current?: {
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    label?: string;
  };
  daily?: Array<{
    tempMin?: number;
    tempMax?: number;
    precipitationSum?: number;
  }>;
}

async function weatherBrief(userId: string): Promise<string> {
  const farms = await pool.query<{ id: string; name: string; location: string | null }>(
    `SELECT id, name, location FROM farms WHERE id IN ${accessibleFarmsSql()} ORDER BY created_at LIMIT 5`,
    [userId],
  );
  const farm = farms.rows[0];
  if (!farm) return 'No farm found. Create a farm in the app first, then ask me for weather again.';

  const result = await weatherService.getWeather(
    { id: userId, name: '', email: '', phone: null, avatarUrl: null, role: 'farm_manager' },
    farm.id,
  );

  if (!result.weather) {
    return `Weather for ${farm.name} is unavailable right now.${!farm.location ? ' Add coordinates to the farm to enable live weather.' : ''}`;
  }

  const data = result.weather as WeatherBriefData;
  const current = data.current;
  const today = data.daily?.[0];
  const tomorrow = data.daily?.[1];
  const lines = [`🌦 Currently at ${farm.name}: ${current?.temperature ?? '--'}°C, ${current?.label ?? 'unknown'}`];
  lines.push(`💧 ${current?.humidity ?? '--'}% humidity · 🌬 ${current?.windSpeed ?? '--'} km/h`);
  if (today) {
    lines.push(`📅 Today: ${today.tempMin}–${today.tempMax}°C, ${today.precipitationSum} mm rain`);
  }
  if (tomorrow) {
    lines.push(`📅 Tomorrow: ${tomorrow.tempMin}–${tomorrow.tempMax}°C, ${tomorrow.precipitationSum} mm rain`);
  }
  return lines.join('\n');
}

async function tasksBrief(userId: string): Promise<string> {
  const result = await pool.query<{
    title: string;
    status: string;
    deadline_at: Date | string | null;
    farm_name: string | null;
  }>(
    `SELECT t.title, t.status, t.deadline_at, f.name AS farm_name
     FROM tasks t
     JOIN farms f ON f.id = t.farm_id
     WHERE t.farm_id IN ${accessibleFarmsSql()}
       AND t.status <> 'finished'
     ORDER BY t.deadline_at IS NULL, t.deadline_at
     LIMIT 50`,
    [userId],
  );
  const rows = result.rows;
  const open = rows.length;
  const overdue = rows.filter((r) => r.deadline_at && parseDate(r.deadline_at)! < Date.now()).length;
  const dueSoon = rows
    .filter((r) => r.deadline_at)
    .filter((r) => {
      const t = parseDate(r.deadline_at)!;
      return t >= Date.now() && t <= Date.now() + 2 * 24 * 60 * 60 * 1000;
    }).length;

  const lines = [`📋 Open tasks: ${open} (${overdue} overdue, ${dueSoon} due within 2 days)`];
  for (const row of rows.slice(0, 5)) {
    lines.push(`• ${row.title}${row.farm_name ? ` · ${row.farm_name}` : ''} (${toShortDate(row.deadline_at)})`);
  }
  if (rows.length === 0) {
    lines.push('Nothing on your plate right now. Nice and calm. 🌱');
  }
  return lines.join('\n');
}

async function stockBrief(userId: string): Promise<string> {
  const result = await pool.query<{
    name: string;
    quantity: number;
    unit: string;
    low_stock_threshold: number | null;
    farm_name: string | null;
  }>(
    `SELECT i.name, i.quantity, i.unit, i.low_stock_threshold, f.name AS farm_name
     FROM inputs i
     JOIN farms f ON f.id = i.farm_id
     WHERE i.farm_id IN ${accessibleFarmsSql()}
       AND i.quantity <= i.low_stock_threshold
     ORDER BY (i.quantity / NULLIF(i.low_stock_threshold, 0)) ASC
     LIMIT 8`,
    [userId],
  );
  if (result.rows.length === 0) {
    return '✅ Inventory is healthy - nothing is low on stock.';
  }
  const lines = ['⚠️ Low stock to re-order:'];
  for (const row of result.rows) {
    lines.push(
      `• ${row.name}: ${row.quantity} ${row.unit} left${row.farm_name ? ` · ${row.farm_name}` : ''}${row.low_stock_threshold ? ` (min ${row.low_stock_threshold})` : ''}`,
    );
  }
  return lines.join('\n');
}

async function adviceReply(text: string): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    return [
      'I can help with weather, tasks and stock right now. 🤖',
      'For deeper agronomy advice, add an OPENAI_API_KEY and just ask me things like:',
      '• "Should I spray for blight this week?"',
      '• "When is the best time to harvest maize?"',
    ].join('\n');
  }
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 220,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You are FarmFlow, a practical WhatsApp farming assistant. Give short, safe, actionable advice (under 160 tokens) for small-to-medium tropical farms. If the question involves crop-protection chemicals, recommend professional advice and caution. Plain text, no markdown.',
          },
          { role: 'user', content: text },
        ],
      }),
    });
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty assistant response');
    return content;
  } catch (error) {
    logger.warn('[whatsapp] AI advice unavailable', { message: (error as Error).message });
    return 'Sorry, my advice engine is offline right now. Try again in a moment, or ask me about weather / tasks / stock.';
  }
}

const HELP_TEXT = `FarmFlow WhatsApp assistant 🌱

Try:
• "weather" - live conditions for your farm
• "tasks" - what's open, overdue or due soon
• "stock" - what's running low
• "advice ..." - ask an agronomy question
• "help" - this menu

To connect a number, reply with:
join <invite-code>`;

async function bindLink(link: LinkRow, phone: string, waName: string | null): Promise<string> {
  await pool.query(
    `UPDATE whatsapp_links
     SET status = 'revoked', whatsapp_number = NULL, updated_at = now()
     WHERE status = 'active' AND whatsapp_number = $1 AND id <> $2`,
    [phone, link.id],
  );
  await pool.query(
    `UPDATE whatsapp_links
     SET whatsapp_number = $1, wa_name = COALESCE($2, wa_name), status = 'active',
         last_session_at = now(), updated_at = now()
     WHERE id = $3`,
    [phone, waName, link.id],
  );
  return [
    `Linked! ✅ This number is now connected to FarmFlow${waName ? `, ${waName}` : ''}.`,
    "You'll get task updates and reminders here if you switch on WhatsApp notifications in Settings.",
    '',
    HELP_TEXT,
  ].join('\n');
}

function onboardingReply(waName: string | null): string {
  return [
    `Hi${waName ? ` ${waName}` : ''}! This is FarmFlow, your farming assistant. 🤖🌱`,
    "Your number is not connected to an account yet.",
    'In the FarmFlow app, open Settings > WhatsApp and tap "Generate invite code".',
    'Then reply here with: join <invite-code>',
  ].join('\n');
}

export const whatsappService = {
  isConfigured(): boolean {
    return whatsappConfigured;
  },

  sendReply,

  verifyHandshake(input: {
    mode?: string;
    token?: string;
  }): boolean {
    return (
      input.mode === 'subscribe' &&
      input.token === env.WHATSAPP_VERIFY_TOKEN &&
      Boolean(env.WHATSAPP_VERIFY_TOKEN)
    );
  },

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !env.WHATSAPP_WEBHOOK_SECRET) return false;
    const expected = createHmac('sha256', env.WHATSAPP_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    const provided = signatureHeader.replace(/^sha256=/, '');
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  },

  /** Processes a verified webhook entry; returns phones to reply to. */
  async handleInbound(
    entry: {
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
    },
  ): Promise<{ phone: string; replies: string[] }[]> {
    const outputs: { phone: string; replies: string[] }[] = [];
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const message of value.messages ?? []) {
        const rawText = message.text?.body?.trim();
        if (rawText === undefined || rawText === '') continue;
        const phone = normalizePhone(message.from);
        const contact = value.contacts?.find((c) => c.wa_id === message.from);
        const waName = contact?.profile?.name ?? null;
        if (!phone) continue;

        const links = await pool.query<LinkRow>(
          `SELECT id, user_id, whatsapp_number, wa_name, invite_code, status, last_session_at
           FROM whatsapp_links
           WHERE whatsapp_number = $1 AND status = 'active'`,
          [phone],
        );
        const link = links.rows[0];

        if (!link) {
          const inviteMatch = /^(?:join|link)\s+([a-z0-9]{6,12})$/i.exec(rawText);
          if (inviteMatch) {
            const pending = await pool.query<LinkRow>(
              `SELECT id, user_id, whatsapp_number, wa_name, invite_code, status, last_session_at
               FROM whatsapp_links
               WHERE invite_code = UPPER($1) AND status = 'invited'`,
              [inviteMatch[1]],
            );
            const target = pending.rows[0];
            if (!target) {
              outputs.push({ phone, replies: ['That invite code is not recognised. Double-check the code in Settings > WhatsApp and try again.'] });
              continue;
            }
            if (target.whatsapp_number && normalizePhone(target.whatsapp_number) !== phone) {
              outputs.push({ phone, replies: ['This invite code already belongs to another phone number.'] });
              continue;
            }
            outputs.push({ phone, replies: [await bindLink(target, phone, waName)] });
            continue;
          }
          outputs.push({ phone, replies: [onboardingReply(waName)] });
          continue;
        }

        await pool.query(
          `UPDATE whatsapp_links SET last_session_at = now(), updated_at = now() WHERE id = $1`,
          [link.id],
        );

        const clean = rawText.toLowerCase().trim();
        let reply: string;
        if (/^(help|menu|start|hi|hello|hey)\b/.test(clean)) {
          reply = HELP_TEXT;
        } else if (/\bweather\b/.test(clean)) {
          reply = await weatherBrief(link.user_id);
        } else if (/\btasks?\b|\boverdue\b|\bdue\b/.test(clean)) {
          reply = await tasksBrief(link.user_id);
        } else if (/\bstock\b|\binventory\b|\blow\b/.test(clean)) {
          reply = await stockBrief(link.user_id);
        } else {
          reply = await adviceReply(rawText);
        }
        outputs.push({ phone, replies: [reply] });
      }
    }
    return outputs;
  },

  async getStatus(userId: string) {
    if (!whatsappConfigured) {
      return { configured: false, status: null, number: null, inviteCode: null };
    }
    const result = await pool.query<LinkRow>(
      `SELECT id, user_id, whatsapp_number, wa_name, invite_code, status, last_session_at
       FROM whatsapp_links WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const link = result.rows[0];
    return {
      configured: true,
      status: link ? link.status : null,
      number: link?.whatsapp_number ?? null,
      waName: link?.wa_name ?? null,
      inviteCode: link && link.status === 'invited' ? link.invite_code : null,
      sessionActive: link ? inSession(link) : false,
    };
  },

  async generateInvite(userId: string): Promise<{ code: string; message: string }> {
    ensureConfigured();
    const existing = await pool.query<LinkRow>(
      `SELECT id FROM whatsapp_links WHERE user_id = $1`,
      [userId],
    );
    const code = inviteCode();
    if (existing.rows[0]) {
      await pool.query(
        `UPDATE whatsapp_links
         SET invite_code = $1, status = 'invited', whatsapp_number = NULL, updated_at = now()
         WHERE user_id = $2`,
        [code, userId],
      );
    } else {
      await pool.query(
        `INSERT INTO whatsapp_links (id, user_id, invite_code, status)
         VALUES ($1, $2, $3, 'invited')`,
        [uid(), userId, code],
      );
    }
    return {
      code,
      message: `Reply "join ${code}" on WhatsApp to connect this account.`,
    };
  },

  async revoke(userId: string): Promise<void> {
    await pool.query(
      `UPDATE whatsapp_links
       SET status = 'revoked', whatsapp_number = NULL, updated_at = now()
       WHERE user_id = $1 AND status <> 'revoked'`,
      [userId],
    );
  },

  /** Admin/test manual message. Session-aware: free-form inside 24h, template otherwise. */
  async send(userId: string, to: string, body: string): Promise<{ id: string }> {
    ensureConfigured();
    const number = normalizePhone(to);
    const link: LinkRow = {
      id: '',
      user_id: userId,
      whatsapp_number: number,
      wa_name: null,
      invite_code: '',
      status: 'active',
      last_session_at: new Date(),
    };
    return sendTextOrTemplate(link, body);
  },

  /** Alerts/reminders - mirror of push sendToUser, gated on linked + prefs. */
  async sendToUser(userId: string, input: WhatsAppSendInput): Promise<void> {
    if (!whatsappConfigured) {
      logger.debug('[whatsapp] Skipped (not configured).', { userId, type: input.type });
      return;
    }

    let prefs: PrefsRow;
    try {
      const result = await pool.query<PrefsRow>(
        `SELECT whatsapp_enabled, task_assignments, deadline_reminders,
                overdue_alerts, task_completions, daily_summary
         FROM notification_preferences WHERE user_id = $1`,
        [userId],
      );
      prefs = result.rows[0] ?? DEFAULT_PREFS;
    } catch (error) {
      logger.error('[whatsapp] Could not load preferences', { message: (error as Error).message });
      return;
    }

    if (!prefs.whatsapp_enabled) return;

    const prefKey = TYPE_PREF[input.type];
    if (prefKey && !prefs[prefKey]) return;

    const links = await pool.query<LinkRow>(
      `SELECT id, user_id, whatsapp_number, wa_name, invite_code, status, last_session_at
       FROM whatsapp_links
       WHERE user_id = $1 AND status = 'active' AND whatsapp_number IS NOT NULL`,
      [userId],
    );
    const link = links.rows[0];
    if (!link?.whatsapp_number) return;

    const body = `${input.title}\n${input.message}`;
    try {
      // Business-initiated alerts must ride an approved template.
      await sendTemplate(link.whatsapp_number, body);
    } catch (error) {
      logger.warn('[whatsapp] Alert template send failed', { message: (error as Error).message });
    }
  },
};