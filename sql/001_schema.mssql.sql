-- SQL Server 2022. Idempotent schema; preserves all existing rows.
IF OBJECT_ID(N'dbo.users',N'U') IS NULL
CREATE TABLE dbo.users (
  id int IDENTITY(1,1) PRIMARY KEY,
  name nvarchar(255) NOT NULL,
  email nvarchar(255) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  password_hash nvarchar(255) NOT NULL,
  role nvarchar(20) NOT NULL CHECK(role IN ('admin','operator','client')),
  must_change_password int NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)),
  active int NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at nvarchar(19) NOT NULL DEFAULT CONVERT(nvarchar(19),SYSUTCDATETIME(),120)
);
IF OBJECT_ID(N'dbo.sessions',N'U') IS NULL
CREATE TABLE dbo.sessions (
  token_hash nvarchar(64) COLLATE Latin1_General_100_BIN2 PRIMARY KEY,
  user_id int NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL
);
IF OBJECT_ID(N'dbo.tickets',N'U') IS NULL
CREATE TABLE dbo.tickets (
  id int IDENTITY(1,1) PRIMARY KEY,
  creator_id int NOT NULL REFERENCES dbo.users(id),
  assignee_id int NULL REFERENCES dbo.users(id),
  subject nvarchar(160) NOT NULL,
  category nvarchar(80) NOT NULL,
  subcategory nvarchar(80) NULL,
  urgency nvarchar(30) NOT NULL,
  impact nvarchar(30) NOT NULL,
  equipment nvarchar(160) NULL,
  location nvarchar(160) NULL,
  description nvarchar(max) NOT NULL,
  phone nvarchar(40) NULL,
  contact_time nvarchar(60) NULL,
  status nvarchar(80) NOT NULL DEFAULT N'Aberto',
  priority nvarchar(30) NOT NULL,
  progress int NOT NULL DEFAULT 0,
  started_at nvarchar(19) NULL,
  expected_end_at nvarchar(19) NULL,
  ended_at nvarchar(19) NULL,
  work_amount float NOT NULL DEFAULT 0,
  scope_complexity nvarchar(40) NULL,
  created_at nvarchar(19) NOT NULL DEFAULT CONVERT(nvarchar(19),SYSUTCDATETIME(),120),
  updated_at nvarchar(19) NOT NULL DEFAULT CONVERT(nvarchar(19),SYSUTCDATETIME(),120)
);
IF OBJECT_ID(N'dbo.ticket_events',N'U') IS NULL
CREATE TABLE dbo.ticket_events (
  id int IDENTITY(1,1) PRIMARY KEY,
  ticket_id int NOT NULL REFERENCES dbo.tickets(id) ON DELETE CASCADE,
  user_id int NOT NULL REFERENCES dbo.users(id),
  kind nvarchar(30) NOT NULL,
  body nvarchar(max) NULL,
  old_status nvarchar(80) NULL,
  new_status nvarchar(80) NULL,
  progress int NULL,
  created_at nvarchar(19) NOT NULL DEFAULT CONVERT(nvarchar(19),SYSUTCDATETIME(),120)
);
IF OBJECT_ID(N'dbo.ticket_options',N'U') IS NULL
CREATE TABLE dbo.ticket_options (id int PRIMARY KEY CHECK(id=1), value nvarchar(max) NOT NULL);
IF OBJECT_ID(N'dbo.ticket_attachments',N'U') IS NULL
CREATE TABLE dbo.ticket_attachments (
  id int IDENTITY(1,1) PRIMARY KEY,
  ticket_id int NOT NULL REFERENCES dbo.tickets(id) ON DELETE CASCADE,
  user_id int NOT NULL REFERENCES dbo.users(id),
  name nvarchar(180) NOT NULL,
  content_type nvarchar(100) NOT NULL,
  size int NOT NULL,
  content varbinary(max) NOT NULL,
  created_at nvarchar(19) NOT NULL DEFAULT CONVERT(nvarchar(19),SYSUTCDATETIME(),120)
);
IF OBJECT_ID(N'dbo.notification_state',N'U') IS NULL
CREATE TABLE dbo.notification_state (id int PRIMARY KEY CHECK(id=1), baseline_event_id int NOT NULL);
IF OBJECT_ID(N'dbo.event_reads',N'U') IS NULL
CREATE TABLE dbo.event_reads (
  user_id int NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  event_id int NOT NULL REFERENCES dbo.ticket_events(id) ON DELETE CASCADE,
  read_at nvarchar(19) NOT NULL DEFAULT CONVERT(nvarchar(19),SYSUTCDATETIME(),120),
  PRIMARY KEY(user_id,event_id)
);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'ix_tickets_creator' AND object_id=OBJECT_ID(N'dbo.tickets'))
CREATE INDEX ix_tickets_creator ON dbo.tickets(creator_id);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'ix_events_ticket' AND object_id=OBJECT_ID(N'dbo.ticket_events'))
CREATE INDEX ix_events_ticket ON dbo.ticket_events(ticket_id);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'ix_attachments_ticket' AND object_id=OBJECT_ID(N'dbo.ticket_attachments'))
CREATE INDEX ix_attachments_ticket ON dbo.ticket_attachments(ticket_id);
