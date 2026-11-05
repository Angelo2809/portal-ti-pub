# Contributing / Contribuindo

Use Node.js 24+, run `npm ci`, then `npm run demo`. Keep identifiers, comments and development documentation in English; preserve the current Portuguese user-facing messages until a translation layer is introduced. Keep the English and Portuguese READMEs consistent.

Before proposing a change, run `npm run build` and verify the affected workflow using fictional demo data. Do not use a real customer database for development.

Never commit `.env` files, databases, backups, personal data, customer screenshots, logs with credentials or private infrastructure configuration. Use `.example` addresses and fictional names in samples. Keep demo seeding explicit, isolated and repeatable without overwriting an existing installation.

Explique o problema e o comportamento final no pull request, com as verificações realizadas. Use apenas dados fictícios, mantenha os READMEs alinhados e preserve a separação entre demonstração e instalação real. Para executar: `npm ci`, `npm run demo` e `npm run build`.
