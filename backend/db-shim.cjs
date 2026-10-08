// Minimal pg-compatible `Client` shim backed by mysql2/promise, used by the
// live regression scripts (*.cjs) after the PostgreSQL -> MySQL migration.
const { createConnection } = require('mysql2/promise');

const MYSQL_URL = /^mysql:\/\/([^:@]*)(?::([^@]*))?@([^:/]+)(?::(\d+))?\/([^?]+)/;

function parseConfig(connectionString) {
  const match = MYSQL_URL.exec(connectionString || '');
  if (match) {
    return {
      host: match[3],
      port: Number(match[4] || 3306),
      user: match[1],
      password: match[2] ?? '',
      database: match[5],
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'farmflow',
  };
}

function translate(sql) {
  return sql
    .replace(/\s*::(text|int|integer|date|uuid|jsonb|timestamptz|float|numeric|smallint|boolean)\b/gi, '')
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\binterval\s+'([^']+)'/gi, (_m, spec) => `INTERVAL ${spec}`)
    .replace(/= TRUE\b/gi, '= 1')
    .replace(/= FALSE\b/gi, '= 0');
}

function coerceParam(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value)) return JSON.stringify(value);
  return value;
}

// Postgres `$n` binds by NUMBER, MySQL `?` by TEXT ORDER. Reorder the params
// so each `?` in reading order receives the value its `$n` referred to.
function orderParams(sql, params) {
  const refs = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  if (refs.length === 0) return params;
  return refs.map((n) => params[n - 1]);
}

class Client {
  constructor(options) {
    this.options = options;
    this.connection = null;
  }

  async connect() {
    this.connection = await createConnection({ ...parseConfig(this.options?.connectionString), charset: 'utf8mb4', timezone: 'local' });
  }

  async query(sql, params = []) {
    const translated = translate(sql).replace(/\$\d+/g, '?');
    const ordered = orderParams(sql, params).map(coerceParam);
    const [result] = await this.connection.query(translated, ordered);
    if (Array.isArray(result)) {
      return { rows: result, rowCount: result.length };
    }
    return {
      rows: [],
      rowCount: result.affectedRows ?? 0,
      affectedRows: result.affectedRows ?? 0,
      insertId: result.insertId,
    };
  }

  async end() {
    if (this.connection) await this.connection.end();
  }
}

module.exports = { Client, parseConfig, translate };