import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import sql from 'mssql';

export function sqlServerConfig(env = process.env) {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!env[key]) throw new Error(`Configure ${key} para conectar ao SQL Server.`);
  }
  const port = Number(env.DB_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT inválida.');
  return {
    server: env.DB_HOST, port, database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD,
    options: { encrypt: env.DB_ENCRYPT !== 'false', trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE === 'true' },
    pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000, requestTimeout: 30000,
  };
}

// Translate only the SQLite constructs used by this application's statements.
export function sqlServerStatement(statement) {
  let query = statement.trim();
  if (query.startsWith('INSERT INTO notification_state')) {
    return `INSERT INTO notification_state(id,baseline_event_id)
      SELECT 1,COALESCE(MAX(id),0) FROM ticket_events
      HAVING NOT EXISTS(SELECT 1 FROM notification_state WITH (UPDLOCK,HOLDLOCK) WHERE id=1)`;
  }
  if (query.startsWith('INSERT INTO ticket_options')) {
    return `MERGE ticket_options WITH (HOLDLOCK) AS target
      USING (SELECT 1 AS id,CAST(@p0 AS nvarchar(max)) AS value) AS source ON target.id=source.id
      WHEN MATCHED THEN UPDATE SET value=source.value
      WHEN NOT MATCHED THEN INSERT(id,value) VALUES(source.id,source.value);`;
  }
  if (query.startsWith('INSERT INTO event_reads')) {
    return `INSERT INTO event_reads(user_id,event_id)
      SELECT @p0,e.id FROM ticket_events e
      WHERE e.ticket_id=@p1 AND e.id<=@p2 AND e.id>@p3 AND e.user_id<>@p4
      AND NOT EXISTS(SELECT 1 FROM event_reads r WITH (UPDLOCK,HOLDLOCK) WHERE r.user_id=@p0 AND r.event_id=e.id)`;
  }
  query = query.replace(/\(e\.id>\? AND e\.user_id<>\? AND r\.event_id IS NULL\) unread/g,
    '(CASE WHEN e.id>? AND e.user_id<>? AND r.event_id IS NULL THEN 1 ELSE 0 END) unread');
  query = query.replace(/\(r\.event_id IS NOT NULL\) is_read/g,
    '(CASE WHEN r.event_id IS NOT NULL THEN 1 ELSE 0 END) is_read');
  const limit = /\s+LIMIT (\d+)\s*$/.exec(query);
  if (limit) query = query.slice(0, limit.index).replace(/^SELECT\s+/i, `SELECT TOP (${limit[1]}) `);
  // During initial setup, hold the empty-key range until the admin insert commits.
  if (query === 'SELECT TOP (1) 1 FROM users') query += ' WITH (UPDLOCK,HOLDLOCK)';
  // Keep the UTC string dates expected by the frontend and by the original SQLite data.
  query = query.replace(/\bCURRENT_TIMESTAMP\b/g, 'CONVERT(nvarchar(19),SYSUTCDATETIME(),120)');
  let parameter = 0;
  // Do not replace question marks inside SQL string literals.
  return query.replace(/'(?:''|[^'])*'|\?/g, token => token === '?' ? `@p${parameter++}` : token);
}

export function bindParameters(request, parameters) {
  parameters.forEach((value, index) => {
    let type = sql.NVarChar(sql.MAX);
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      type = sql.VarBinary(sql.MAX); value = Buffer.from(value);
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Parâmetro numérico inválido.');
      type = Number.isInteger(value) ? (Math.abs(value) > 2147483647 ? sql.BigInt : sql.Int) : sql.Float;
    } else if (typeof value === 'boolean') {
      type = sql.Bit;
    }
    request.input(`p${index}`, type, value ?? null);
  });
  return request;
}

export async function openDatabase(root) {
  if (!process.env.DB_HOST) {
    if (!process.env.PORTAL_DB_PATH && process.env.DB_DRIVER !== 'sqlite') {
      throw new Error('Configure DB_HOST para SQL Server. SQLite exige DB_DRIVER=sqlite ou PORTAL_DB_PATH explícito.');
    }
    const { openSqlite } = await import('./sqlite-database.js');
    return openSqlite(root);
  }
  const pool = await new sql.ConnectionPool(sqlServerConfig()).connect();
  pool.on('error', error => console.error('SQL Server:', error.code || 'erro de conexão'));
  const context = new AsyncLocalStorage();
  const db = {
    driver: 'mssql',
    middleware(_req, res, next) {
      const state = { transaction: null };
      res.on('close', () => {
        if (state.transaction) state.transaction.rollback().catch(() => {});
      });
      context.run(state, next);
    },
    async exec(statement) {
      const command = statement.trim().toUpperCase();
      const state = context.getStore();
      if (command === 'BEGIN IMMEDIATE') {
        if (!state || state.transaction) throw new Error('Transação fora da requisição ou já iniciada.');
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        state.transaction = transaction;
        return;
      }
      if (command === 'COMMIT' || command === 'ROLLBACK') {
        if (!state?.transaction) throw new Error('Transação não iniciada.');
        const transaction = state.transaction;
        state.transaction = null;
        if (command === 'COMMIT') await transaction.commit();
        else await transaction.rollback();
        return;
      }
      return new sql.Request(state?.transaction || pool).query(sqlServerStatement(statement));
    },
    prepare(statement) {
      const query = sqlServerStatement(statement);
      const execute = async (parameters, insert = false) => {
        const request = new sql.Request(context.getStore()?.transaction || pool);
        bindParameters(request, parameters);
        try {
          return await request.query(query + (insert ? '; SELECT CAST(SCOPE_IDENTITY() AS int) AS lastInsertRowid;' : ''));
        } catch (error) {
          if ([2601, 2627].includes(error.number)) throw new Error('UNIQUE: valor já cadastrado.', { cause: error });
          throw error;
        }
      };
      return {
        async get(...parameters) { return (await execute(parameters)).recordset?.[0]; },
        async all(...parameters) { return (await execute(parameters)).recordset || []; },
        async run(...parameters) {
          const insert = /^INSERT\s+/i.test(query);
          const result = await execute(parameters, insert);
          return { changes: result.rowsAffected?.[0] || 0, lastInsertRowid: insert ? result.recordset?.[0]?.lastInsertRowid : undefined };
        },
      };
    },
    close: () => pool.close(),
  };
  try {
    await pool.request().batch(readFileSync(new URL('../sql/001_schema.mssql.sql', import.meta.url), 'utf8'));
    return db;
  } catch (error) {
    await pool.close();
    throw error;
  }
}
