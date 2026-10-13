import { pool } from '../database/pool.js';

export async function getRolePermissions(roleId: string): Promise<string[]> {
  const result = await pool.query<{ code: string }>(
    `SELECT p.code
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1
     ORDER BY p.code`,
    [roleId],
  );
  return result.rows.map((row) => row.code);
}
