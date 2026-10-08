import { env } from '../../config/env.js';

const appUrl = env.APP_URL.replace(/\/$/, '');

function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f5;font-family:Segoe UI,Arial,sans-serif;color:#1f2a20;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e7df;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 8px;">
                <div style="font-size:18px;font-weight:700;color:#2f7d32;">&#127807; FarmFlow</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 24px;line-height:1.55;">${body}</td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f0f3ee;font-size:12px;color:#6b7a6d;">
                You're receiving this because you use FarmFlow.<br />
                <a href="${esc(appUrl)}" style="color:#2f7d32;text-decoration:none;">${esc(appUrl)}</a> &middot; Contact support if this wasn't meant for you.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function actionButton(link: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:8px;background:#2f7d32;padding:12px 20px;"><a href="${esc(link)}" style="color:#ffffff;font-weight:600;text-decoration:none;font-size:14px;">${esc(label)}</a></td></tr></table>`;
}

function taskLink(taskId: string): string {
  return `${appUrl}/tasks?task=${encodeURIComponent(taskId)}`;
}

export interface TaskEmailContext {
  taskId: string;
  taskTitle: string;
  dueLabel: string;
  farmName: string;
  notes: string;
}

export interface DailySummaryContext {
  name: string;
  total: number;
  completed: number;
  dueToday: number;
  overdue: number;
  items: { title: string; dueLabel: string; status: string }[];
}

export const emailTemplates = {
  welcome(name: string) {
    const subject = 'Welcome to FarmFlow';
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p>Welcome aboard! Your FarmFlow account is ready. Log in to manage tasks, track deadlines, and keep your team in the loop.</p>
       <p>With FarmFlow you can:</p>
       <ul>
         <li>Assign and track tasks on your farms</li>
         <li>Get deadline reminders before things slip</li>
         <li>See work summaries for every field hand</li>
       </ul>`,
    );
    return { subject, html, body: `Welcome to FarmFlow, ${name}!` };
  },

  passwordReset(name: string, link: string) {
    const subject = 'Reset your FarmFlow password';
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p>We got a request to reset your FarmFlow password. If that was you, use the button below — the link expires in 30 minutes.</p>
       ${actionButton(link, 'Reset password')}
       <p>If you didn't request this, you can safely ignore this email.</p>`,
    );
    return { subject, html };
  },

  taskAssigned(name: string, task: TaskEmailContext) {
    const subject = `New task: ${task.taskTitle}`;
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p>A new task was assigned to you.</p>
       <p><strong>${esc(task.taskTitle)}</strong><br />Farm: ${esc(task.farmName)}<br />Due: ${esc(task.dueLabel)}</p>
       ${actionButton(taskLink(task.taskId), 'Open task')}
       ${task.notes ? `<p>${esc(task.notes)}</p>` : ''}`,
    );
    return { subject, html };
  },

  taskReminder(name: string, task: TaskEmailContext) {
    const subject = `Reminder: ${task.taskTitle}`;
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p>A gentle reminder about your task:</p>
       <p><strong>${esc(task.taskTitle)}</strong> — due ${esc(task.dueLabel)} (Farm: ${esc(task.farmName)})</p>
       ${actionButton(taskLink(task.taskId), 'View task')}
       ${task.notes ? `<p>${esc(task.notes)}</p>` : ''}`,
    );
    return { subject, html };
  },

  taskDueSoon(name: string, task: TaskEmailContext) {
    const subject = `Due soon: ${task.taskTitle}`;
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p><strong>${esc(task.taskTitle)}</strong> on ${esc(task.farmName)} is due ${esc(task.dueLabel)}. Make sure it's wrapped up on time.</p>
       ${actionButton(taskLink(task.taskId), 'View task')}`,
    );
    return { subject, html };
  },

  taskOverdue(name: string, task: TaskEmailContext) {
    const subject = `Overdue: ${task.taskTitle}`;
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p><strong>${esc(task.taskTitle)}</strong> on ${esc(task.farmName)} is now overdue (was due ${esc(task.dueLabel)}). Let's get this back on track.</p>
       ${actionButton(taskLink(task.taskId), 'View task')}`,
    );
    return { subject, html };
  },

  taskCompleted(name: string, task: TaskEmailContext) {
    const subject = `Task completed: ${task.taskTitle}`;
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p>Nice work — <strong>${esc(task.taskTitle)}</strong> on ${esc(task.farmName)} was marked as finished.</p>
       ${actionButton(taskLink(task.taskId), 'View task')}`,
    );
    return { subject, html };
  },

  taskComment(name: string, task: TaskEmailContext, commenterName: string) {
    const subject = `New comment on "${task.taskTitle}"`;
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p>${esc(commenterName)} commented on <strong>${esc(task.taskTitle)}</strong>.</p>
       ${task.notes ? `<p>"${esc(task.notes)}"</p>` : ''}
       ${actionButton(taskLink(task.taskId), 'View conversation')}`,
    );
    return { subject, html };
  },

  dailySummary(name: string, ctx: DailySummaryContext) {
    const subject = `Your FarmFlow summary — ${ctx.completed}/${ctx.total} done`;
    const items = ctx.items
      .map(
        (item) => `<li><strong>${esc(item.title)}</strong> (${esc(item.dueLabel)}) — ${esc(item.status)}</li>`,
      )
      .join('');
    const html = layout(
      subject,
      `<p>Hi ${esc(name)},</p>
       <p>Here's where things stand today:</p>
       <ul>
         <li>${ctx.total} tasks assigned</li>
         <li>${ctx.completed} completed</li>
         <li>${ctx.dueToday} due today</li>
         <li>${ctx.overdue} overdue</li>
       </ul>
       ${items ? `<p><strong>Needs attention:</strong></p><ul>${items}</ul>` : ''}`,
    );
    return { subject, html };
  },
};