import { randomBytes, scryptSync } from 'node:crypto';

export const demoAccounts = [
  { name: 'Alex Demo · Administração', email: 'admin@selectto.example', role: 'admin', password: 'DemoAdmin1!' },
  { name: 'Sam Demo · Atendimento', email: 'operator@selectto.example', role: 'operator', password: 'DemoOperator1!' },
  { name: 'Charlie Demo · Selectto Cliente', email: 'client@selectto.example', role: 'client', password: 'DemoClient1!' },
  { name: 'Robin Demo · Selectto Cliente', email: 'other@selectto.example', role: 'client', password: 'DemoOther1!' },
];

// Explicit opt-in only. Never add known accounts to an existing installation.
export async function seedDemoDatabase(db) {
  if (db.driver !== 'sqlite') throw new Error('Demo mode requires a separate SQLite database.');
  await db.exec('CREATE TABLE IF NOT EXISTS demo_metadata (id INTEGER PRIMARY KEY, version TEXT NOT NULL)');
  const marker = await db.prepare('SELECT version FROM demo_metadata WHERE id=1').get();
  if (await db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    if (marker?.version !== 'selectto-v1') {
      throw new Error('Demo mode refuses to seed an existing non-demo database.');
    }
    return;
  }
  const { defaultTicketOptions } = await import('../shared/ticket-options.js');
  const timestamp = hoursAgo => new Date(Date.now() - hoursAgo * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  await db.exec('BEGIN IMMEDIATE');
  try {
    const userIds = [];
    for (const account of demoAccounts) {
      const salt = randomBytes(16).toString('hex');
      const hash = `${salt}:${scryptSync(account.password, salt, 64).toString('hex')}`;
      userIds.push(Number((await db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)')
        .run(account.name, account.email, hash, account.role)).lastInsertRowid));
    }
    await db.prepare('INSERT INTO ticket_options(id,value) VALUES(1,?)').run(JSON.stringify(defaultTicketOptions));
    await db.prepare('INSERT INTO demo_metadata(id,version) VALUES(1,?)').run('selectto-v1');
    const examples = [
      ['Acesso ao ERP de demonstração', 'Sistemas', 'ERP', 'Aberto', 'Alta', 0],
      ['Configurar VPN do notebook fictício', 'Rede e Conectividade', 'VPN', 'Em atendimento', 'Média', 45],
      ['Impressora do escritório de exemplo', 'Hardware', 'Impressoras', 'Aguardando cliente', 'Baixa', 70],
      ['Novo usuário no ambiente de testes', 'Suporte ao Usuário', 'Novo usuário', 'Resolvido', 'Média', 100],
      ['Configurar caixa de e-mail fictícia', 'E-mail', 'Configuração', 'Resolvido', 'Baixa', 100],
      ['Solicitação duplicada de demonstração', 'Outros', 'Solicitação diversa', 'Cancelado', 'Baixa', 0],
      ['Wi-Fi da sala de treinamento', 'Rede e Conectividade', 'Wi-Fi', 'Aberto', 'Alta', 0],
      ['Instalar periférico de exemplo', 'Hardware', 'Periféricos', 'Em atendimento', 'Média', 25],
    ];
    for (const [index, [subject, category, subcategory, status, priority, progress]] of examples.entries()) {
      const creatorId = userIds[index === 6 ? 3 : 2];
      const created = timestamp(24 * (index + 1));
      const started = status === 'Aberto' || status === 'Cancelado' ? null : timestamp(24 * (index + 1) - 1);
      const ended = ['Resolvido', 'Cancelado'].includes(status) ? timestamp(24 * (index + 1) - 3) : null;
      const ticketId = Number((await db.prepare(`INSERT INTO tickets(creator_id,assignee_id,subject,category,subcategory,urgency,impact,location,description,status,priority,progress,started_at,ended_at,work_amount,scope_complexity,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(creatorId, started ? userIds[1] : null, subject, category, subcategory,
        'Média', 'Médio', 'Selectto Cliente · Escritório fictício', '<p>Solicitação fictícia para explorar o portal. Nenhum dado de cliente real foi utilizado.</p>',
        status, priority, progress, started, ended, started ? 1.5 : 0, 'Baixa', created, ended || started || created)).lastInsertRowid);
      await db.prepare('INSERT INTO ticket_events(ticket_id,user_id,kind,body,progress,created_at) VALUES(?,?,?,?,?,?)')
        .run(ticketId, creatorId, 'created', 'Chamado fictício aberto para demonstração.', 0, created);
      if (started || ended) {
        await db.prepare('INSERT INTO ticket_events(ticket_id,user_id,kind,body,old_status,new_status,progress,created_at) VALUES(?,?,?,?,?,?,?,?)')
          .run(ticketId, userIds[1], 'update', 'Atendimento de demonstração atualizado.', 'Aberto', status, progress, ended || started);
      }
      if (index === 1) {
        await db.prepare('INSERT INTO ticket_events(ticket_id,user_id,kind,body,created_at) VALUES(?,?,?,?,?)')
          .run(ticketId, userIds[1], 'comment', '<p>Configuração de exemplo aplicada. Pode testar a conexão?</p>', started);
        const content = Buffer.from('Selectto demo attachment. Fictional VPN configuration evidence.\n');
        await db.prepare('INSERT INTO ticket_attachments(ticket_id,user_id,name,content_type,size,content) VALUES(?,?,?,?,?,?)')
          .run(ticketId, creatorId, 'demo-evidence.txt', 'text/plain', content.length, content);
      }
    }
    await db.prepare('INSERT INTO notification_state(id,baseline_event_id) VALUES(1,0)').run();
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
