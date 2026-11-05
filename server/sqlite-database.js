// Explicit SQLite mode for standalone installations and legacy snapshot upgrades.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

export function openSqlite(root) {
const databasePath = process.env.PORTAL_DB_PATH || path.join(root, 'data', 'portal.sqlite');
mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
// Preserve an upgrade snapshot before removing the former company structure.
if (db.prepare("PRAGMA table_info(users)").all().some(c => c.name === 'client_id')) {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  copyFileSync(databasePath, databasePath + '.before-single-portal.bak');
  db.exec(`BEGIN;
    DROP TABLE IF EXISTS operator_clients;
    DROP INDEX IF EXISTS ix_tickets_client;
    ALTER TABLE users DROP COLUMN client_id;
    ALTER TABLE tickets DROP COLUMN client_id;
    DROP TABLE IF EXISTS clients;
    COMMIT;`);
}
db.exec(readFileSync(path.join(root, 'sql', '001_schema.sql'), 'utf8'));

const ticketColumns=new Set(db.prepare('PRAGMA table_info(tickets)').all().map(c=>c.name));
for(const [name,type] of Object.entries({location:'TEXT',started_at:'TEXT',expected_end_at:'TEXT',ended_at:'TEXT',work_amount:'REAL NOT NULL DEFAULT 0',scope_complexity:'TEXT'}))if(!ticketColumns.has(name))db.exec('ALTER TABLE tickets ADD COLUMN '+name+' '+type);
// Use the actual event dates for existing tickets, rather than the last comment date.
db.exec(`UPDATE tickets SET started_at=(SELECT MIN(created_at) FROM ticket_events WHERE ticket_id=tickets.id AND new_status='Em atendimento') WHERE started_at IS NULL;
  UPDATE tickets SET ended_at=COALESCE((SELECT MAX(created_at) FROM ticket_events WHERE ticket_id=tickets.id AND new_status=tickets.status),updated_at) WHERE ended_at IS NULL AND status IN ('Resolvido','Cancelado');`);


db.driver = 'sqlite';
// Awaitable routes must not interleave transactions on the single SQLite connection.
let pending = Promise.resolve();
db.middleware = (_req, res, next) => {
  const previous = pending;
  pending = new Promise(resolve => {
    res.once('close', resolve);
    res.once('finish', resolve);
  });
  previous.then(next);
};
return db;
}
