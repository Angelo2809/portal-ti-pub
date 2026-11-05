# Selectto · Portal de Atendimento TI

**Português** · [English](README.md)

> **Uso não comercial:** este repositório público disponibiliza o código sob a [PolyForm Noncommercial License 1.0.0](LICENSE). Uso comercial fora das finalidades permitidas pela licença exige um acordo escrito separado com a Selectto.

Portal completo de atendimento TI, com telas próprias para **solicitantes** e **equipe de suporte**, além de dashboard administrativo. A ideia é reunir solicitações, conversas, anexos, responsáveis e prazos de atendimento em um só lugar, com identidade Selectto.

Esta edição pública apresenta a empresa fictícia **Selectto Cliente**. A cópia foi preparada sem banco de clientes, arquivos privados de ambiente, capturas do ambiente original ou credenciais de infraestrutura. Os identificadores do código e os novos desenvolvimentos usam inglês; a interface, as mensagens ao usuário e os valores padrão do fluxo continuam em português brasileiro. Ainda não há interface em inglês.

## Demonstração em poucos passos

Instale **Node.js 24 ou superior** e npm. A demo dispensa banco externo e cadastro prévio.

```sh
npm ci
npm run demo
```

Abra **http://127.0.0.1:5173**. A API roda na porta 3001. No PowerShell, use `npm.cmd` se `npm.ps1` estiver bloqueado. O comando de demonstração seleciona seu próprio SQLite e não carrega um `.env` privado.

Na tela de login, escolha um perfil para preencher os campos e clique em **Entrar**:

| Perfil | E-mail | Senha | O que permite explorar |
| --- | --- | --- | --- |
| Administrador | `admin@selectto.example` | `DemoAdmin1!` | Dashboard, chamados, usuários, campos e SLAs |
| Operador | `operator@selectto.example` | `DemoOperator1!` | Fila de atendimento, chamados atribuídos, conversa e planejamento |
| Solicitante | `client@selectto.example` | `DemoClient1!` | Início do cliente, seus chamados, abertura e conversa |
| Outro solicitante | `other@selectto.example` | `DemoOther1!` | Conferir o isolamento entre solicitantes |

Para comparar as duas áreas ao mesmo tempo, use perfis de navegador separados ou uma janela anônima. Abas do mesmo perfil compartilham a sessão.

A carga inicial contém oito chamados em diferentes situações, uma conversa, um anexo de texto e um chamado de outro solicitante. O primeiro cliente enxerga sete chamados; a equipe enxerga oito. As datas são relativas à primeira execução. Tudo é fictício, inclusive nomes e e-mails.

As alterações ficam em `data/demo.sqlite` e sobrevivem ao reinício. Para recomeçar, pare a aplicação e remova **somente** `data/demo.sqlite`, `data/demo.sqlite-wal` e `data/demo.sqlite-shm`, se existirem. A próxima execução recria a demo. A carga recusa bancos existentes que não sejam da demo e nunca popula SQL Server.

### Demo com Docker

```sh
docker compose up --build
```

Abra **http://127.0.0.1:3001**. O Compose compila a interface, inicia a API e mantém o SQLite no volume `portal-demo`. A porta fica acessível apenas na máquina local. Não depende de rede Docker externa ou SQL Server. `docker compose down` preserva os dados; `docker compose down --volumes` apaga o volume da demo deste projeto Compose e reinicia os dados na próxima subida.

As senhas de demonstração são públicas. Mantenha a demo local. Para uma instalação real, siga o modo independente com `DEMO_MODE=false` e usuários próprios.

## O que foi desenvolvido

- **Área do solicitante:** abertura com descrição formatada, classificação, contato e anexos; acompanhamento de progresso, histórico e conversa.
- **Área do operador:** fila geral, filtros, atribuição de responsável, prioridade, status, andamento, datas, esforço e complexidade.
- **Administração:** criação e ativação de usuários, perfis, senhas temporárias e configuração de categorias, subcategorias, status, prioridades e SLAs em horário comercial.
- **Dashboard:** período e comparação anterior, evolução diária, status, prioridades, categorias/subcategorias, equipe e SLAs de início e resolução.
- **Notificações:** atualização periódica e marcação de leitura.
- **Controle de acesso na API:** cliente vê seus próprios chamados, operador atende a fila e administrador gerencia usuários e configurações globais.
- **Autenticação local:** senhas com scrypt e salt, tokens de sessão armazenados como hash, cookie HttpOnly, limitação básica de tentativas e sanitização de texto formatado.
- **Persistência:** SQLite para execução independente; adaptador e esquema SQL Server para ambientes gerenciados.

Na preparação pública, as referências ao cliente original foram substituídas por Selectto Cliente, a marca Selectto foi mantida, a demo foi isolada dos dados reais e a dependência da infraestrutura privada foi retirada do fluxo inicial. Também foi adicionada documentação bilíngue.

## Usar como sistema independente

```sh
npm ci
```

Copie `.env.example` para `.env`: no PowerShell, `Copy-Item .env.example .env`; no macOS/Linux, `cp .env.example .env`.

```sh
npm run dev
```

Abra http://127.0.0.1:5173 e crie o primeiro administrador. Essa instalação começa vazia, usa `data/portal.sqlite` e **não cria contas de teste**. O administrador cadastra operadores e solicitantes, que recebem uma senha temporária e precisam trocá-la no primeiro acesso. Redefinições também exigem nova senha. Não há envio automático de e-mail; a senha temporária deve ser compartilhada por um canal adequado.

Para executar a interface compilada e a API juntas:

```sh
npm run build
npm start
```

Abra http://127.0.0.1:3001. Para servir a demo compilada: `npm run build` e depois `npm run demo:serve`.

| Variável | Função |
| --- | --- |
| `DB_DRIVER=sqlite` | Habilita explicitamente SQLite quando não há host SQL Server |
| `PORTAL_DB_PATH` | Caminho do SQLite, relativo à pasta de execução quando não absoluto |
| `DB_HOST` | Quando preenchido, seleciona SQL Server e tem precedência sobre SQLite |
| `DEMO_MODE` | Apenas `true` habilita a carga fictícia e as credenciais na tela de login |
| `PORT` | Porta da API/interface compilada, padrão 3001 |
| `COOKIE_SECURE` | `false` para HTTP local; `true` para implantação com HTTPS |

Não aponte a demo para dados reais. Uma implantação real deve começar com banco vazio, `DEMO_MODE=false`, HTTPS, cookies seguros, backup e acesso de rede adequado. Enquanto não há usuários, a criação do primeiro administrador está aberta; conclua essa etapa antes de expor o serviço.

### SQL Server

Use `.env.sqlserver.example` como modelo de `.env` e informe seu próprio servidor, banco, usuário e senha. Crie o banco/login antes de iniciar. A aplicação aplica o esquema idempotente de [`sql/001_schema.mssql.sql`](sql/001_schema.mssql.sql); a conta precisa de permissões para inicializar o esquema e para as operações normais. Nenhum provisionador, servidor, senha ou rede privada acompanha o projeto. O Compose padrão é da demo SQLite; adapte a implantação para SQL Server.

`GET /health` verifica a conexão. O utilitário manual `server/migrate-sqlite.js` atende instalações SQLite legadas sem a demo, exige destino SQL Server vazio e verifica os dados importados. Ele não é um exportador da demonstração: os metadados da demo ficam fora do mapeamento de origem. Faça backup e leia o utilitário antes de executar.

## Como incorporar em outro sistema

Hoje o portal já funciona sozinho, com login, gestão de usuários e permissões próprios. Para virar um módulo de um ERP, intranet ou outro sistema da empresa, a base é a separação entre a interface React, a API JSON em `/api` e as regras compartilhadas de chamados, SLA e dashboard.

O [guia de integração](docs/INTEGRATION.md) explica os pontos atuais da API, o mapeamento dos perfis e as mudanças necessárias para login corporativo/SSO. Autenticação externa, OIDC/SAML, provisionamento automático de usuários, sessão compartilhada, webhooks e SDK de plugin **ainda não estão implementados**. São caminhos de evolução, e não funcionalidades prontas anunciadas pelo projeto.

A identidade visual da organização é configurada em [`src/branding.js`](src/branding.js), separadamente dos créditos Selectto. As imagens de marca estão em `Assets/`. O nome Selectto Cliente é apenas demonstrativo.

## Comandos e estrutura

| Comando | Uso |
| --- | --- |
| `npm run demo` | Demo com Vite, API e banco próprio |
| `npm run dev` | Desenvolvimento com seu `.env` |
| `npm run dev:server` | API com reinício automático |
| `npm run dev:front` | Interface no Vite |
| `npm run build` | Compila a interface em `dist/` |
| `npm start` | Serve API e interface compilada com seu `.env` |
| `npm run demo:serve` | Serve a demo compilada; exige build anterior |

```text
src/       Telas React, estilos e configuração da marca
server/    API Express, autenticação, adaptadores e carga fictícia
shared/    Senhas, opções, cálculos de SLA e dashboard
sql/       Esquemas SQLite e SQL Server
scripts/   Inicializador de demonstração multiplataforma
docs/      Documentação de integração
Assets/    Imagens da marca Selectto
```

Tecnologias: React 19, Vite, Express 5, SQLite do Node, `mssql`, Motion e Lucide. A CI instala as dependências e compila a interface. O repositório não inclui uma suíte de testes automatizados.

## Regras e limites atuais

- Uma instalação representa uma organização. Existe isolamento por autor do chamado, mas não há multitenancy nem cadastro de empresas.
- SLA considera a janela comercial configurada, sem calendário de feriados. Espera pelo cliente continua contando. Resolução conta desde a abertura. Alterar metas/janela recalcula os SLAs existentes.
- No dashboard, totais de abertura usam a data de criação; resolvidos e tempo médio usam a data final, incluindo chamados mais antigos. Status reflete a situação atual, sem fotografia histórica. O tempo médio usa horas comerciais.
- Os valores `Aberto`, `Em atendimento` e `Resolvido` fazem parte da lógica atual. Antes de traduzir a interface, separe códigos persistidos dos textos exibidos.
- Até cinco anexos, 10 MB por arquivo e 25 MB no total, armazenados no banco. Downloads exigem acesso ao chamado. Não há antivírus integrado, armazenamento de objetos ou abertura por e-mail.
- Ainda não há SSO, MFA, recuperação por e-mail, sockets, feriados ou limitador compartilhado entre instâncias. Sessões duram sete dias; a limitação de login fica na memória do processo.
- A configuração atual serve na raiz do domínio. Prefixos em proxy, incorporação entre origens e montagem sob outro caminho exigem adaptar rotas e caminhos do frontend/API.

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) e [SECURITY.md](SECURITY.md).

## Licença

O código está disponível sob a [PolyForm Noncommercial License 1.0.0](LICENSE), com atribuição em [NOTICE](NOTICE). Ela permite usar, modificar e distribuir o projeto nas finalidades definidas em seus termos, incluindo estudo não comercial e projetos pessoais. Exploração comercial, como vender o projeto ou oferecê-lo como serviço comercial hospedado, exige um acordo escrito separado com a Selectto, salvo uso expressamente permitido pela licença. O acesso público ao repositório não concede autorização comercial irrestrita.

As dependências de terceiros mantêm suas próprias licenças. Nomes e logos Selectto são elementos de marca; a licença de código não concede direitos de marca.
