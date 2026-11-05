// Explicit one-time migration. Never imports snapshots during application startup.
import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sql from 'mssql';
import { sqlServerConfig, bindParameters } from './database.js';

const args = process.argv.slice(2);
const sourcePath = args[args.indexOf('--source') + 1];
const outputPath = args[args.indexOf('--output') + 1];
if (!args.includes('--source') || !args.includes('--output') || !sourcePath || !outputPath) {
  throw new Error('Uso: node server/migrate-sqlite.js --source origem.sqlite --output dump.sql');
}
const tables = ['users','sessions','tickets','ticket_events','ticket_options','ticket_attachments','notification_state','event_reads'];
const identityTables = new Set(['users','tickets','ticket_events','ticket_attachments']);
const quote = name => '[' + name.replaceAll(']', ']]') + ']';
const literal = value => value == null ? 'NULL' : value instanceof Uint8Array ? '0x' + Buffer.from(value).toString('hex') : typeof value === 'number' ? String(value) : "N'" + String(value).replaceAll("'", "''") + "'";
const canonical = row => JSON.stringify(Object.fromEntries(Object.entries(row).map(([key,value]) => [key,value instanceof Uint8Array ? {hex:Buffer.from(value).toString('hex')} : value])));
const digest = rows => createHash('sha256').update(rows.map(canonical).join('\n')).digest('hex');
mkdirSync(path.dirname(outputPath), { recursive: true });
const source = new DatabaseSync(path.resolve(sourcePath), { readOnly: true });
let pool;
let transaction;
try {
  if (source.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('SQLite com falha de integridade.');
  await backup(source, outputPath + '.source.sqlite');
  const sourceTables = source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
  for (const table of sourceTables) if (!tables.includes(table)) throw new Error('Tabela de origem sem mapeamento: ' + table);
  const rows = new Map(tables.map(table => [table, source.prepare(`SELECT * FROM ${quote(table)} ORDER BY ${table === 'sessions' ? 'token_hash' : table === 'event_reads' ? 'user_id,event_id' : 'id'}`).all()]));
  const schema = readFileSync(new URL('../sql/001_schema.mssql.sql', import.meta.url), 'utf8');
  const dump = [`USE ${quote(process.env.DB_NAME)};`, schema, 'SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;'];
  for (const table of tables) dump.push(`IF EXISTS(SELECT 1 FROM dbo.${quote(table)}) THROW 51000,N'O destino deve estar vazio: ${table}',1;`);
  for (const table of tables) {
    const records = rows.get(table);
    if (!records.length) continue;
    if (identityTables.has(table)) dump.push(`SET IDENTITY_INSERT dbo.${quote(table)} ON;`);
    for (const row of records) dump.push(`INSERT INTO dbo.${quote(table)} (${Object.keys(row).map(quote).join(',')}) VALUES (${Object.values(row).map(literal).join(',')});`);
    if (identityTables.has(table)) dump.push(`SET IDENTITY_INSERT dbo.${quote(table)} OFF;`);
  }
  dump.push('COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;');
  writeFileSync(outputPath, dump.join('\n') + '\n');
  const manifest = { database:process.env.DB_NAME, source:path.basename(sourcePath), tables:{}, dump_sha256:createHash('sha256').update(readFileSync(outputPath)).digest('hex') };
  pool = await new sql.ConnectionPool(sqlServerConfig()).connect();
  await pool.request().batch(schema);
  transaction = new sql.Transaction(pool);
  await transaction.begin();
  for (const table of tables) {
    const result = await new sql.Request(transaction).query(`SELECT COUNT(*) AS n FROM dbo.${quote(table)} WITH (TABLOCKX,HOLDLOCK)`);
    if (result.recordset[0].n) throw new Error('Importação cancelada: destino já contém dados em ' + table);
  }
  for (const table of tables) {
    const records = rows.get(table);
    if (records.length) {
      for (const row of records) {
        const columns = Object.keys(row);
        const request = bindParameters(new sql.Request(transaction), Object.values(row));
        const insert = `INSERT INTO dbo.${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_,i)=>'@p'+i).join(',')});`;
        await request.query(identityTables.has(table) ? `SET IDENTITY_INSERT dbo.${quote(table)} ON; ${insert} SET IDENTITY_INSERT dbo.${quote(table)} OFF;` : insert);
      }
    }
    const order = table === 'sessions' ? 'token_hash' : table === 'event_reads' ? 'user_id,event_id' : 'id';
    const result = await new sql.Request(transaction).query(`SELECT * FROM dbo.${quote(table)} ORDER BY ${order}`);
    const columns = source.prepare(`PRAGMA table_info(${quote(table)})`).all().map(column=>column.name);
    const restored = result.recordset.map(row=>Object.fromEntries(columns.map(column=>[column,column === 'expires_at' ? Number(row[column]) : row[column]])));
    if (restored.length !== records.length || digest(restored) !== digest(records)) throw new Error('Dados divergentes após importar ' + table);
    manifest.tables[table] = {rows:records.length,sha256:digest(records)};
  }
  await transaction.commit();
  transaction = null;
  writeFileSync(outputPath + '.manifest.json', JSON.stringify(manifest,null,2));
  console.log('Migração confirmada; conteúdo e contagens verificados:', manifest.tables);
} catch (error) {
  if (transaction) await transaction.rollback().catch(()=>{});
  throw error;
} finally {
  source.close();
  if (pool) await pool.close();
}
