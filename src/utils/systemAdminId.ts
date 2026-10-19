/**
 * System Administrator IDs use the shape `FF-SYS-XXXX-XXXX`. Operators only ever
 * need to provide the thirteen-character value; the separating hyphens are added
 * by the system. This live formatter runs on every keystroke so the input is
 * always displayed in canonical form regardless of what was typed or pasted.
 */
export const SYSTEM_ADMIN_ID_PREFIX = 'FF-SYS';

const CHUNK_LENGTH = 4;
const CHUNK_COUNT = 2;

export function formatSystemAdminId(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefixCompact = SYSTEM_ADMIN_ID_PREFIX.replace(/-/g, '');
  if (!compact.startsWith(prefixCompact)) {
    return compact;
  }
  const body = compact.slice(prefixCompact.length).slice(0, CHUNK_LENGTH * CHUNK_COUNT);
  if (body.length <= CHUNK_LENGTH) {
    return `${SYSTEM_ADMIN_ID_PREFIX}-${body}`;
  }
  return `${SYSTEM_ADMIN_ID_PREFIX}-${body.slice(0, CHUNK_LENGTH)}-${body.slice(CHUNK_LENGTH)}`;
}
