# Selectto · IT Service Portal

[Português](README.pt-BR.md) · **English**

> **Noncommercial use:** this public repository is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use outside its permitted purposes requires a separate written agreement with Selectto.

A full-stack IT service portal with separate **requester** and **support** workspaces, plus an administrator dashboard. Built by Selectto to centralize requests, conversations, attachments, ownership and service-level tracking in one place.

This public edition uses **Selectto Cliente**, a fictional customer, and generated demonstration data. It includes no customer database, private environment files, original customer screenshots or infrastructure credentials. Source identifiers and new development use English; the current product interface, default workflow labels and user-facing messages are in Brazilian Portuguese. An English UI is not implemented.

## Try it locally

Requires **Node.js 24+** and npm. No external database or account is needed for the demo.

```sh
npm ci
npm run demo
```

Open **http://127.0.0.1:5173**. The API runs on port 3001. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Demo commands select a dedicated SQLite file and do not load a private `.env` file.

Choose a role on the login screen to fill in its credentials, then click **Entrar**:

| Profile | Email | Password | Experience |
| --- | --- | --- | --- |
| Administrator | `admin@selectto.example` | `DemoAdmin1!` | Dashboard, all tickets, users, workflow and SLA settings |
| Operator | `operator@selectto.example` | `DemoOperator1!` | Support queue, assigned tickets, conversations and planning |
| Requester | `client@selectto.example` | `DemoClient1!` | Requester home, own requests, new ticket and conversations |
| Other requester | `other@selectto.example` | `DemoOther1!` | Separate requester for checking ticket isolation |

Use separate browser profiles or a private window to compare requester and support screens simultaneously: sessions are shared between tabs in the same browser profile.

The fixture creates eight tickets across open, active, waiting, resolved and canceled states. It includes a conversation, a downloadable text attachment and a second requester whose ticket is hidden from the first. Dates are relative to the first demo launch. Changes persist in `data/demo.sqlite`; restarting does not reset accounts or tickets. To start fresh, stop the demo and remove **only** `data/demo.sqlite`, `data/demo.sqlite-wal` and `data/demo.sqlite-shm`, if present. The next launch recreates the fixture. The fixture refuses an existing non-demo database and never seeds SQL Server.

### Docker demo

```sh
docker compose up --build
```

Open **http://127.0.0.1:3001**. Compose builds the frontend, runs the API, persists SQLite in the `portal-demo` volume and binds the service to the local machine. It needs no external Docker network or SQL Server. `docker compose down` preserves changes. `docker compose down --volumes` deletes this Compose project's demo volume and resets its data.

The known credentials above are deliberately public. Keep this demonstration local. For a real installation use the standalone setup below with `DEMO_MODE=false` and your own users.

## What was built

- Requester workspace: create requests with rich text, classification, contact details and attachments; follow progress, history and conversations.
- Support workspace: shared queue, filters, assignment, priority, status, progress and planning dates; effort and complexity fields.
- Administration: user activation, roles, temporary passwords, configurable categories/subcategories, statuses, priorities and business-hour SLA targets.
- Executive dashboard: date range, previous-period comparison, daily volume, categories, subcategories, priorities, status, team performance and start/resolution SLAs.
- Notifications and read receipts, with polling while the page is visible.
- Backend authorization: requesters access only their own tickets; operators access the support queue; administrators manage users and global configuration.
- Password hashing with salted scrypt, hashed session tokens, HttpOnly cookies, basic login attempt limiting and rich-text sanitization.
- SQLite for self-contained installations; SQL Server adapter and schema for managed environments.

The public preparation replaces customer branding with Selectto Cliente, retains Selectto assets, separates demonstration data from real installations, removes private infrastructure assumptions and supplies bilingual setup and integration documentation.

## Standalone installation

```sh
npm ci
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` on macOS/Linux).

```sh
npm run dev
```

Open http://127.0.0.1:5173 and create the first administrator. This installation starts empty, uses `data/portal.sqlite` and creates **no demo users**. The administrator creates operator and requester accounts; temporary passwords must be changed at first login. Password resets also require a change. Email delivery is not implemented: share temporary passwords through an appropriate channel.

To serve compiled frontend and API together:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001. For the compiled demo, use `npm run build` followed by `npm run demo:serve`.

| Setting | Purpose |
| --- | --- |
| `DB_DRIVER=sqlite` | Explicit SQLite opt-in when no SQL Server host is configured |
| `PORTAL_DB_PATH` | SQLite path; relative paths resolve from the working directory |
| `DB_HOST` | Selects SQL Server when nonempty; takes precedence over SQLite |
| `DEMO_MODE` | Only literal `true` enables fixture loading and login-screen credentials |
| `PORT` | API/compiled frontend port; default 3001 |
| `COOKIE_SECURE` | `false` for local HTTP; `true` for HTTPS deployments |

Never point demo mode at a real database. Deploy an empty standalone installation with `DEMO_MODE=false`, HTTPS, secure cookies, database backups and appropriate network access. Initial administrator creation is public while the database has no users; complete setup before exposing the service.

### SQL Server

Use `.env.sqlserver.example` as your `.env` template and supply your own host, database, application login and password. Create the database/login first. Startup applies the idempotent schema in [`sql/001_schema.mssql.sql`](sql/001_schema.mssql.sql); the account needs permissions for that schema initialization as well as normal application queries. No server, password, network or database provisioner is bundled. The default Compose file is specifically the SQLite demo; adapt deployment configuration for SQL Server.

`GET /health` checks database connectivity. The explicit migration utility in `server/migrate-sqlite.js` supports legacy non-demo SQLite installations, requires an empty SQL Server target and verifies imported data. It is not a demo export/import workflow; demo metadata is intentionally outside its source table mapping. Back up data and read the utility before running it.

## Run alone or integrate into a company system

The portal already runs independently with its own login, user management and permission checks. It can also become a company system's support module because the React interface communicates with the backend through JSON endpoints under `/api`, while workflow/SLA logic lives in shared modules.

See the [integration guide](docs/INTEGRATION.md) for the current API boundaries, role mapping and the work required for company login/SSO. External authentication, OIDC/SAML, automatic user provisioning, shared sessions, webhooks and a drop-in plugin SDK are **not implemented**. The guide describes an extension path, not existing capabilities.

For visual branding, edit [`src/branding.js`](src/branding.js). Selectto credit assets are in `Assets/`; organization logos shown in the workspace/login are configurable separately from that credit. All demo customer references are fictional.

## Development

| Command | Purpose |
| --- | --- |
| `npm run demo` | Local demo, React/Vite and API with a separate database |
| `npm run dev` | Development using your `.env` |
| `npm run dev:server` | API with watch mode |
| `npm run dev:front` | Vite development server |
| `npm run build` | Production frontend build in `dist/` |
| `npm start` | API and compiled frontend using your `.env` |
| `npm run demo:serve` | Compiled demo; requires a previous build |

```text
src/       React views, styling and branding configuration
server/    Express API, authorization, database adapters and demo fixture
shared/    Password policy, ticket options, SLA and dashboard calculations
sql/       SQLite and SQL Server schemas
scripts/   Cross-platform demo launcher
docs/      Integration and contribution guidance
Assets/    Selectto brand images
```

Stack: React 19, Vite, Express 5, Node's SQLite driver, `mssql`, Motion and Lucide. CI installs dependencies and builds the frontend. The repository does not include an automated test suite.

## Behavior and current limits

- Each deployment represents one organization. Requester ownership is enforced, but there is no tenant/company isolation model or company administration.
- SLA counts configured business minutes, excludes time outside the working window, and has no holiday calendar. Waiting for the requester still counts. Resolution time starts at ticket creation. Changing SLA configuration recalculates existing tickets.
- Dashboard opening totals use creation dates; resolution counts and average duration use completion dates, including tickets opened earlier. Status reflects the current state, not a historical snapshot. Average duration uses business hours.
- Keep the default `Aberto`, `Em atendimento` and `Resolvido` workflow labels; transitions currently depend on these stored Portuguese values. Translating the interface requires separating stored codes from display labels first.
- Up to five attachments per ticket, 10 MB per file and 25 MB total. Attachment content is stored in the database and downloads require ticket access. External object storage, antivirus scanning and email ingestion are not included.
- No SSO, MFA, password-recovery emails, realtime sockets, holiday calendars or multi-instance shared rate limiter. Sessions last seven days. Login limiting is in process memory.
- Development uses ports 5173 and 3001. Other deployment paths, cross-origin embedding and proxy prefixes require frontend/API routing changes; serving at the domain root is the existing configuration.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

This project is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE), with the attribution in [NOTICE](NOTICE). It permits use, modification and distribution for the purposes defined in that license, including noncommercial study and personal projects. Commercial exploitation, such as selling the project or offering it as a commercial hosted service, requires a separate written agreement with Selectto unless the use is expressly permitted by the license. Public repository access does not grant unrestricted commercial rights.

Third-party dependencies retain their own licenses. Selectto names and logos are brand assets; the code license does not grant trademark rights.
