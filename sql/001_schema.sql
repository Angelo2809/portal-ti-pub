-- SQLite 3 / node:sqlite. Applied automatically on startup.
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','operator','client')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  urgency TEXT NOT NULL,
  impact TEXT NOT NULL,
  equipment TEXT,
  location TEXT,
  description TEXT NOT NULL,
  phone TEXT,
  contact_time TEXT,
  status TEXT NOT NULL DEFAULT 'Aberto',
  priority TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  expected_end_at TEXT,
  ended_at TEXT,
  work_amount REAL NOT NULL DEFAULT 0,
  scope_complexity TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  body TEXT,
  old_status TEXT,
  new_status TEXT,
  progress INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_tickets_creator ON tickets(creator_id);
CREATE INDEX IF NOT EXISTS ix_events_ticket ON ticket_events(ticket_id);

CREATE TABLE IF NOT EXISTS ticket_options (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  content BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_attachments_ticket ON ticket_attachments(ticket_id);

CREATE TABLE IF NOT EXISTS notification_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  baseline_event_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event_reads (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES ticket_events(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,event_id)
);
