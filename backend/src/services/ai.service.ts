import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import type { AuthUser } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { weatherService } from './weather.service.js';

const AI_MODEL = 'gpt-4o-mini';
const AI_TIMEOUT_MS = 30_000;
const MAX_CONTEXT_FARMS = 5;
const MAX_CONTEXT_TASKS = 15;
const MAX_CONTEXT_INPUTS = 8;

const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiSuggestion {
  farmId: string;
  farmName: string;
  title: string;
  priority: TaskPriority;
  deadlineAt: string | null;
  rationale: string;
}

interface FarmRow {
  id: string;
  name: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
}

interface ContextFarm extends FarmRow {
  fieldCount: number;
  workerCount: number;
}

interface OpenTaskRow {
  title: string;
  priority: string;
  status: string;
  deadline_at: string | null;
  farm_name: string | null;
  assignee_name: string | null;
}

interface StockRow {
  name: string;
  type: string;
  unit: string;
  quantity: string;
  farm_name: string | null;
}

function apiKey(): string | null {
  const key = env.OPENAI_API_KEY;
  if (!key || !key.trim()) return null;
  return key.trim();
}

function requireKey(): string {
  const key = apiKey();
  if (!key) {
    throw new AppError(
      501,
      'The AI assistant is not configured. Add an OPENAI_API_KEY to enable it.',
      'AI_NOT_CONFIGURED',
    );
  }
  return key;
}

interface ContextBundle {
  farms: ContextFarm[];
  text: string;
}

async function loadContext(actor: AuthUser, farmId?: string): Promise<ContextBundle> {
  const poolParams: unknown[] = [];
  let farmWhere = "status = 'active'";
  if (farmId) {
    poolParams.push(farmId);
    farmWhere += ' AND id = $1';
  }

  const farmsRes = await pool.query<FarmRow>(
    `SELECT id, name, location, latitude, longitude
     FROM farms
     WHERE ${farmWhere}
     ORDER BY name
     LIMIT ${MAX_CONTEXT_FARMS}`,
    poolParams,
  );

  const farms: ContextFarm[] = farmsRes.rows.map((row) => ({ ...row, fieldCount: 0, workerCount: 0 }));

  if (farms.length === 0) {
    return { farms, text: 'The user has no farms yet.' };
  }

  const farmIds = farms.map((farm) => farm.id);

  const countsRes = await pool.query<{ farm_id: string; field_count: string; worker_count: string }>(
    `SELECT f.id AS farm_id,
            (SELECT COUNT(*) FROM fields fl WHERE fl.farm_id = f.id) AS field_count,
            (SELECT COUNT(*) FROM workers w WHERE w.farm_id = f.id AND w.status = 'active') AS worker_count
     FROM farms f
     WHERE f.id = ANY($1)`,
    [farmIds],
  );
  const countsById = new Map(countsRes.rows.map((row) => [row.farm_id, row]));
  for (const farm of farms) {
    const counts = countsById.get(farm.id);
    farm.fieldCount = counts ? Number(counts.field_count) : 0;
    farm.workerCount = counts ? Number(counts.worker_count) : 0;
  }

  const tasksRes = await pool.query<OpenTaskRow>(
    `SELECT t.title, t.priority, t.status, t.deadline_at,
            COALESCE(f.name, '') AS farm_name,
            COALESCE(w.name, '') AS assignee_name
     FROM tasks t
     LEFT JOIN farms f ON f.id = t.farm_id
     LEFT JOIN workers w ON w.id = t.assigned_to
     WHERE t.status <> 'finished'
       AND t.farm_id = ANY($1)
     ORDER BY CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              t.deadline_at ASC, t.created_at DESC
     LIMIT ${MAX_CONTEXT_TASKS}`,
    [farmIds],
  );

  const stockRes = await pool.query<StockRow>(
    `SELECT i.name, i.type, i.unit, i.quantity, COALESCE(f.name, '') AS farm_name
     FROM inputs i
     LEFT JOIN farms f ON f.id = i.farm_id
     WHERE (i.low_stock_threshold > 0 AND i.quantity <= i.low_stock_threshold) OR i.quantity = 0
     LIMIT ${MAX_CONTEXT_INPUTS}`,
  );

  const weatherLines: string[] = [];
  for (const farm of farms.slice(0, 3)) {
    if (!farm.latitude || !farm.longitude) continue;
    try {
      const weather = await weatherService.getWeather(actor, farm.id);
      const payload = weather.weather as {
        current: {
          temperature: number;
          humidity: number;
          precipitation: number;
          windSpeed: number;
          label: string;
        };
      } | null;
      if (payload) {
        const current = payload.current;
        weatherLines.push(
          `${farm.name} weather now: ${current.label}, ${Math.round(current.temperature)}°C, ` +
            `humidity ${Math.round(current.humidity)}%, precipitation ${current.precipitation} mm, ` +
            `wind ${Math.round(current.windSpeed)} km/h.`,
        );
      }
    } catch {
      logger.warn('AI context weather skipped', { farmId: farm.id });
    }
  }

  const lines: string[] = [];
  for (const farm of farms) {
    const location = farm.location ? `, located at ${farm.location}` : '';
    const coords = farm.latitude && farm.longitude ? ` (coordinates ${farm.latitude}, ${farm.longitude})` : '';
    lines.push(
      `Farm "${farm.name}"${location}${coords}: ${farm.fieldCount} fields, ${farm.workerCount} active workers.`,
    );
  }
  if (farmsRes.rows.length === 0) {
    lines.push('No active farms.');
  }
  if (tasksRes.rows.length === 0) {
    lines.push('No open tasks.');
  } else {
    lines.push('Open tasks:');
    for (const task of tasksRes.rows) {
      const deadline = task.deadline_at ? `, deadline ${task.deadline_at}` : '';
      const assignee = task.assignee_name ? ` assigned to ${task.assignee_name}` : '';
      lines.push(
        `- [${task.priority}] ${task.title} (${task.status}${task.farm_name ? `, farm ${task.farm_name}` : ''}${deadline}${assignee})`,
      );
    }
  }
  if (stockRes.rows.length === 0) {
    lines.push('No low or out-of-stock inputs.');
  } else {
    lines.push('Low / out-of-stock inputs:');
    for (const stock of stockRes.rows) {
      lines.push(
        `- ${stock.name} (${stock.type}${stock.farm_name ? `, farm ${stock.farm_name}` : ''}): ${stock.quantity} ${stock.unit} remaining`,
      );
    }
  }
  if (weatherLines.length > 0) {
    lines.push(weatherLines.join('\n'));
  }

  return { farms, text: lines.join('\n') };
}

async function callOpenAI(
  apiKey: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { temperature: number; maxTokens: number; json?: boolean },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        ...(options.json ? { response_format: { type: 'json_object' as const } } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError(
        502,
        'The AI provider could not complete the request. Please try again.',
        'AI_PROVIDER_ERROR',
      );
    }
    return (await response.json()) as {
      choices: { message: { content: string } }[];
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn('OpenAI call failed', { message: (error as Error).message });
    throw new AppError(
      502,
      'The AI assistant could not complete the request. Please try again.',
      'AI_PROVIDER_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}

function systemPrompt(context: string): string {
  return [
    'You are FarmFlow, a friendly farm-management assistant for smallholder farms in Nigeria.',
    'Answer questions about the user\'s farms, tasks, inputs and weather using ONLY the farm context below.',
    'If the data does not answer the question, say so and suggest what could be checked. Keep answers concise and practical.',
    '',
    '--- Farm context ---',
    context,
    '--- End of farm context ---',
  ].join('\n');
}

function parseAssistantReply(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

const SUGGESTION_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export const aiService = {
  status() {
    return { configured: Boolean(apiKey()) };
  },

  async chat(actor: AuthUser, message: string, history: ChatHistoryItem[]) {
    const key = requireKey();
    const context = await loadContext(actor);

    const response = await callOpenAI(
      key,
      [
        { role: 'system', content: systemPrompt(context.text) },
        ...history.map((item) => ({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        })),
        { role: 'user', content: message },
      ],
      { temperature: 0.6, maxTokens: 600 },
    );

    const reply = response.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new AppError(
        502,
        'The AI assistant returned an empty response. Please try again.',
        'AI_PROVIDER_ERROR',
      );
    }
    return { reply };
  },

  async suggestTasks(actor: AuthUser, farmId?: string): Promise<{ suggestions: AiSuggestion[] }> {
    const key = requireKey();
    const context = await loadContext(actor, farmId);
    if (context.farms.length === 0) {
      return { suggestions: [] };
    }

    const farmCatalog = context.farms
      .map((farm) => `${farm.name} (id: ${farm.id})`)
      .join(', ');

    const response = await callOpenAI(
      key,
      [
        {
          role: 'system',
          content:
            'You are FarmFlow\'s agronomy assistant. Based on the farm context, suggest 3 to 6 concrete ' +
            'actions the farm manager should take next, prioritising urgent or time-sensitive work ' +
            '(weather, deadlines, low stock). Return JSON only, matching this shape:\n' +
            '{"suggestions":[{"farmId":"one of the ids below","title":"short task title",' +
            '"priority":"low|medium|high|critical","deadlineAt":"YYYY-MM-DD" or null,' +
            '"rationale":"one sentence"}]}\n' +
            `Available farms: ${farmCatalog}`,
        },
        { role: 'user', content: 'What should I work on next?' },
      ],
      { temperature: 0.4, maxTokens: 700, json: true },
    );

    const raw = parseAssistantReply(response.choices?.[0]?.message?.content ?? '');
    const rawItems = Array.isArray(raw)
      ? (raw as unknown[])
      : ((raw as { suggestions?: unknown[] } | null)?.suggestions ?? []);

    const firstFarm = context.farms[0];
    const farmById = new Map(context.farms.map((farm) => [farm.id, farm]));

    const suggestions: AiSuggestion[] = [];
    for (const item of rawItems.slice(0, 10)) {
      if (!item || typeof item !== 'object') continue;
      const candidate = item as Record<string, unknown>;
      const title = typeof candidate.title === 'string' ? candidate.title.trim().slice(0, 120) : '';
      if (title.length < 2) continue;

      const priority = SUGGESTION_PRIORITIES.includes(candidate.priority as TaskPriority)
        ? (candidate.priority as TaskPriority)
        : 'medium';

      const target =
        typeof candidate.farmId === 'string' ? farmById.get(candidate.farmId) ?? firstFarm : firstFarm;

      let deadlineAt: string | null = null;
      if (typeof candidate.deadlineAt === 'string') {
        const date = new Date(candidate.deadlineAt);
        if (!Number.isNaN(date.getTime())) {
          deadlineAt = date.toISOString();
        }
      }

      const rationale =
        typeof candidate.rationale === 'string' ? candidate.rationale.trim().slice(0, 240) : '';

      suggestions.push({
        farmId: target.id,
        farmName: target.name,
        title,
        priority,
        deadlineAt,
        rationale,
      });
    }

    return { suggestions };
  },
};