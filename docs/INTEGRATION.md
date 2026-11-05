# Integration guide / Guia de integração

[English README](../README.md) · [README em português](../README.pt-BR.md)

## English

### Current boundaries

The React application uses a small `api()` wrapper in `src/main.jsx`, fetching `/api` with credentials. Express in `server/index.js` resolves a local session, authorizes the user and calls the database adapter. Shared modules contain SLA, dashboard and password-policy rules. This is an application with extension points, not a packaged embeddable module.

| Route | Current behavior |
| --- | --- |
| `GET /health` | Database connectivity; no login required |
| `GET /api/bootstrap` | Initial setup state; demo flag/known accounts only in explicit demo mode |
| `POST /api/setup` | Create first administrator; disabled once a user exists |
| `POST /api/login` | Email/password login; sets `portal_session` cookie |
| `POST /api/logout` | Revoke current session |
| `GET /api/me` | Current authenticated user |
| `POST /api/password` | Change password; rotates sessions |
| `GET/POST /api/users` | Administrator user listing/creation |
| `PATCH /api/users/:id` | Administrator edits role, name, email or active state |
| `POST /api/users/:id/reset-password` | Administrator temporary password/reset |
| `GET /api/operators` | Active staff available for assignment |
| `GET/PUT /api/ticket-options` | Read workflow options; administrator updates |
| `GET/POST /api/tickets` | Authorized list/create |
| `GET/PATCH /api/tickets/:id` | Authorized details/update |
| `POST /api/tickets/:id/comments` | Conversation message |
| `POST /api/tickets/:id/read` | Read receipts through a given event |
| `GET /api/tickets/:id/attachments/:attachmentId` | Authorized binary attachment download |
| `GET /api/notifications` | Current user's notifications |
| `GET /api/dashboard` | Administrator metrics, with `from`/`to` date query parameters |

The server file is authoritative for request/response shapes; this is not a versioned public API contract. In particular, stored workflow labels are Portuguese, and payloads use the existing snake_case fields.

### Standalone

Use built-in accounts and sessions. An administrator grants access by creating an active user with one of the supported roles. Users created by the administrator change a temporary password before accessing tickets. No external identity provider is needed.

### First integration: link to a separate portal

Deploy the portal on a support subdomain and add a link in the company's main application. This preserves the existing root-relative paths. The portal initially keeps its own login. This is the smallest deployment change and does not imply shared authentication.

### Company login / SSO extension

Implement and review the following before claiming shared login support:

1. Add a server-side identity adapter for the company's provider. For OIDC, validate signatures, issuer, audience, expiration, state and nonce through a maintained library. Never trust browser-supplied roles or identity headers arriving directly from the public network.
2. Add a stable mapping table from provider issuer/subject to local `users.id`. Tickets/history must continue referencing stable local IDs. Email alone should not be the persistent identity key.
3. Map company permissions to `client`, `operator` or `admin` on the server, defaulting to no access when permission is missing. Define activation, revocation and synchronization behavior explicitly.
4. After a verified identity and access check, issue the existing portal session or replace `currentUser()`/`auth()` with a server-side session integration. Decide whether externally managed users can use local passwords; the current schema requires a password hash and currently has no external-user type.
5. Enforce permission changes and deactivation on existing sessions, define logout behavior and test expiry/revocation. The current API already checks local `active` state per request.
6. Test requester ownership, staff/admin boundaries, user provisioning, lost access, token replay, origin checks and attachment authorization. Keep authorization on API routes even if navigation is hidden.

| Company permission (example) | Local role | Access |
| --- | --- | --- |
| `support.request` | `client` | Own requests only |
| `support.work` | `operator` | Support queue, planning and conversations |
| `support.admin` | `admin` | Queue, dashboard, users and global configuration |
| None | None | Deny access |

These permission strings are design examples; the application does not currently consume them. Do not implement SSO by passing a user ID, email or role through query parameters, local storage or iframe messages.

### Mounting inside a larger application

For a module such as `/support`, introduce a configurable frontend base/API URL and adjust Vite base, asset paths, server fallback routing, session cookie scope and proxy forwarding together. The current source assumes `/`, `/api` and `/assets`. Serve the module from the same origin where practical; the API checks write-request Origin against Host and uses SameSite strict cookies. Cross-origin embedding needs a deliberate authentication, cookie and CSRF design. No permissive CORS or iframe bridge is included.

For a code-level module, extract route construction into an Express router factory with injected identity/database dependencies, and export a React root with navigation/API configuration. Today `server/index.js` opens its database and starts listening at module load, and `src/main.jsx` mounts directly into `#root`. Refactoring those boundaries is still required. Add versioned API contracts or events only when a consuming system needs them; no event bus, webhook delivery or SDK exists yet.

Multiple companies in one database would require tenant IDs, tenant-scoped queries, permissions, attachments and tests across every boundary. Requester-level filtering alone does not provide multitenancy. Use separate deployments until that model is implemented.

## Português

### O que já está separado

A interface React chama `/api` por um wrapper em `src/main.jsx`. O Express em `server/index.js` resolve a sessão local, verifica permissões e usa o adaptador de banco. As regras de SLA, dashboard e senhas ficam em `shared/`. Essa separação facilita evoluir o portal para um módulo, mas ainda não existe um pacote de integração pronto.

A tabela acima relaciona as rotas atuais. O código do servidor define os formatos reais das requisições/respostas; não há contrato público versionado. Os campos já usam os nomes existentes, incluindo snake_case, e os valores persistidos do fluxo continuam em português.

### Sistema independente

O login e as sessões já funcionam localmente. O administrador libera acesso criando um usuário ativo com perfil `client`, `operator` ou `admin`. Quem recebe senha temporária precisa trocá-la antes de acessar os chamados. Não é necessário provedor externo.

### Integração inicial por link

Uma opção direta é publicar o portal em um subdomínio de suporte e incluir um link no sistema da empresa. Assim os caminhos atuais continuam funcionando na raiz e o portal mantém inicialmente seu próprio login. Isso não compartilha autenticação automaticamente.

### Compartilhar login e liberação de acesso

Para usar o login corporativo, implemente no backend:

1. Um adaptador de identidade que valide o provedor da empresa. Em OIDC, valide assinatura, emissor, destinatário, expiração, state e nonce com biblioteca mantida. Não confie em perfil enviado pelo navegador ou em cabeçalhos públicos.
2. Um vínculo persistente entre emissor/identificador do provedor e `users.id`. Chamados e históricos precisam manter IDs locais estáveis; e-mail sozinho não deve ser a chave permanente da identidade.
3. Um mapeamento de permissões corporativas para os perfis locais, negando acesso quando não houver liberação. A tabela de exemplo acima sugere `support.request`, `support.work` e `support.admin`; esses nomes ainda não são consumidos pelo portal.
4. Emissão de sessão do portal após validar identidade e permissão, ou adaptação de `currentUser()`/`auth()` à sessão corporativa. Defina também se contas externas poderão usar senha local; hoje o esquema exige hash de senha e não distingue usuários externos.
5. Regras para ativação, revogação, expiração, sincronização de perfis e logout. Atualmente o backend já verifica o campo local `active` em cada requisição autenticada.
6. Testes de autor do chamado, limites entre operador/admin, provisionamento, perda de acesso, origem das requisições e anexos. Esconder um menu não substitui a autorização na API.

Não compartilhe login passando ID, e-mail ou perfil por URL, localStorage ou mensagem de iframe. SSO, OIDC/SAML e provisionamento automático ainda precisam ser desenvolvidos.

### Incorporar na aplicação da empresa

Para montar em `/support`, torne configuráveis a base da interface e a URL da API. Ajuste em conjunto Vite, caminhos de imagens, fallback do servidor, escopo do cookie e proxy. Hoje o código usa `/`, `/api` e `/assets` fixos. Prefira mesma origem quando possível: a API compara Origin e Host nas escritas e o cookie usa SameSite strict. Incorporação entre origens exige projetar autenticação, cookies e proteção CSRF. Não existe CORS permissivo ou ponte de iframe pronta.

Para integração no código, extraia a criação das rotas para uma fábrica de Express Router com identidade/banco injetáveis e exporte uma raiz React com configuração de navegação/API. Atualmente importar `server/index.js` já abre o banco e inicia o servidor; `src/main.jsx` monta diretamente em `#root`. Essa refatoração ainda precisa ser feita. SDK, webhooks, contratos versionados e barramento de eventos também não estão implementados.

Várias empresas no mesmo banco exigiriam tenant IDs e isolamento em consultas, permissões, anexos e testes de todas as rotas. O filtro por autor do chamado não implementa multitenancy. Até existir esse modelo, use instalações separadas.
