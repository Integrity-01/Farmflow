import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function storageKeyFor(originalName: string): string {
  const ext = path.extname(originalName).slice(0, 12).toLowerCase();
  const base = originalName.replace(path.extname(originalName), '');
  const safe = base.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 60);
  return `${crypto.randomUUID()}${safe ? `-${safe}` : ''}${ext}`;
}