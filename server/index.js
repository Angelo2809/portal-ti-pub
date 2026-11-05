import express from 'express';
import { openDatabase } from './database.js';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';
import { isStrongPassword, PASSWORD_HINT } from '../shared/password-policy.js';
import { buildDashboard, dashboardDay, shiftDay, validDashboardDay } from '../shared/dashboard.js';
import { defaultTicketOptions, normalizeTicketOptions, ticketSla } from '../shared/ticket-options.js';
import { demoAccounts, seedDemoDatabase } from './demo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = await openDatabase(root);
const demoMode = process.env.DEMO_MODE === 'true';
if (demoMode) await seedDemoDatabase(db);
// Existing history has no reliable read receipts; start notifications at this upgrade.
await db.prepare('INSERT INTO notification_state(id,baseline_event_id) SELECT 1,COALESCE(MAX(id),0) FROM ticket_events WHERE 1 ON CONFLICT(id) DO NOTHING').run();
const notificationBaseline = (await db.prepare('SELECT baseline_event_id FROM notification_state WHERE id=1').get()).baseline_event_id;
const unreadCommentsSql = `(SELECT COUNT(*) FROM ticket_events e WHERE e.ticket_id=t.id AND e.kind='comment' AND e.id>? AND e.user_id<>? AND NOT EXISTS(SELECT 1 FROM event_reads r WHERE r.event_id=e.id AND r.user_id=?))`;

const app = express();
app.disable('x-powered-by');
app.use(db.middleware);
app.get('/health', async (_req, res) => {await db.prepare('SELECT 1 AS ok').get();res.json({ ok: true, database: db.driver });});
app.use(express.json({ limit: '36mb' }));
app.use('/assets', express.static(path.join(root, 'Assets')));
const fail = (res, code, message) => res.status(code).json({ error: message });
const hashPassword = (password) => {const salt = randomBytes(16).toString('hex');return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;};
function verifyPassword(password, saved) {try {const [salt, key] = saved.split(':');return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(key, 'hex'));} catch {return false;}}
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
function temporaryPassword() {
  let password;
  do {password = randomBytes(12).toString('base64url');} while (!isStrongPassword(password));
  return password;
}
const clean = (value) => sanitizeHtml(String(value || ''), { allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'span', 'div', 'font'], allowedAttributes: { span: ['style'], p: ['style'], div: ['style'], font: ['color', 'size'] }, allowedStyles: { '*': { color: [/^#[0-9a-fA-F]{6}$/], 'font-size': [/^(12|14|16|18|20|24|28)px$/], 'text-align': [/^(left|center|right)$/] } } });
const str = (v, max = 255) => String(v ?? '').trim().slice(0, max);
function userView(u) {return { id: u.id, name: u.name, email: u.email, role: u.role, must_change_password: !!u.must_change_password, active: !!u.active };}
async function currentUser(req) {const token = /(?:^|; )portal_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];if (!token) return null;return (await db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(tokenHash(token), Date.now())) || null;}
async function auth(req, res, next) {req.user = await currentUser(req);if (!req.user) return fail(res, 401, 'Entre para continuar.');if (req.user.must_change_password && !['/api/me', '/api/password', '/api/logout'].includes(req.path)) return fail(res, 403, 'Defina sua senha antes de continuar.');next();}
function admin(req, res, next) {if (req.user.role !== 'admin') return fail(res, 403, 'Acesso exclusivo do administrador.');next();}
async function ticketFor(req, res) {const ticket = await db.prepare('SELECT t.*, creator.name creator_name, assignee.name assignee_name FROM tickets t JOIN users creator ON creator.id=t.creator_id LEFT JOIN users assignee ON assignee.id=t.assignee_id WHERE t.id=?').get(Number(req.params.id));if (!ticket) {fail(res, 404, 'Chamado não encontrado.');return null;}if (req.user.role === 'client' && ticket.creator_id !== req.user.id) {fail(res, 403, 'Sem acesso a este chamado.');return null;}return ticket;}
async function makeSession(res, userId) {const token = randomBytes(32).toString('base64url');const days = 7;await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token), userId, Date.now() + days * 86400000);res.cookie('portal_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false', maxAge: days * 86400000, path: '/' });}
app.use('/api', (req, res, next) => {if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {const origin = req.get('origin');if (origin && new URL(origin).host !== req.get('host')) return fail(res, 403, 'Origem não permitida.');}next();});

app.get('/api/bootstrap', async (_req, res) => res.json({
  setup: !(await db.prepare('SELECT 1 FROM users LIMIT 1').get()),
  demo: demoMode,
  ...(demoMode ? { accounts: demoAccounts.map(({ name, email, role, password }) => ({ name, email, role, password })) } : {}),
}));
app.post('/api/setup', async (req, res) => {
  if (await db.prepare('SELECT 1 FROM users LIMIT 1').get()) return fail(res,403,'Administrador já configurado.');
  const name=str(req.body.name),email=str(req.body.email).toLowerCase(),password=String(req.body.password||'');
  if(!name||!/^\S+@\S+\.\S+$/.test(email))return fail(res,400,'Informe nome e email válido.');
  if(!isStrongPassword(password))return fail(res,400,PASSWORD_HINT);
  await db.exec('BEGIN IMMEDIATE');
  try {
    if(await db.prepare('SELECT 1 FROM users LIMIT 1').get()){
      await db.exec('COMMIT');
      return fail(res,403,'Administrador já configurado.');
    }
    const id=(await db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run(name,email,hashPassword(password))).lastInsertRowid;
    await makeSession(res,id);
    const user=userView(await db.prepare('SELECT * FROM users WHERE id=?').get(id));
    await db.exec('COMMIT');
    res.json({user});
  } catch(error) {
    try { await db.exec('ROLLBACK'); } catch {}
    throw error;
  }
});
const attempts = new Map();
app.post('/api/login', async (req, res) => {const email = str(req.body.email).toLowerCase(),key = `${req.ip}:${email}`,state = attempts.get(key);if (state && state.until > Date.now() && state.count >= 8) return fail(res, 429, 'Muitas tentativas. Tente novamente mais tarde.');const u = await db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);if (!u || !verifyPassword(String(req.body.password || ''), u.password_hash)) {const n = state?.until > Date.now() ? state.count + 1 : 1;attempts.set(key, { count: n, until: Date.now() + 15 * 60000 });return fail(res, 401, 'Email ou senha inválidos.');}attempts.delete(key);await makeSession(res, u.id);res.json({ user: userView(u) });});
app.post('/api/logout', auth, async (req, res) => {const token = /(?:^|; )portal_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));res.clearCookie('portal_session', { path: '/' }).json({ ok: true });});
app.get('/api/me', auth, (req, res) => res.json({ user: userView(req.user) }));
app.post('/api/password', auth, async (req, res) => {const password = String(req.body.password || '');if (!isStrongPassword(password)) return fail(res, 400, PASSWORD_HINT);if (!req.user.must_change_password && !verifyPassword(String(req.body.current_password || ''), req.user.password_hash)) return fail(res, 403, 'Senha atual incorreta.');await db.prepare('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?').run(hashPassword(password), req.user.id);await db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.user.id);await makeSession(res, req.user.id);res.json({ ok: true });});

app.get('/api/users', auth, admin, async (_req, res) => res.json({ users: await db.prepare('SELECT id,name,email,role,must_change_password,active,created_at FROM users ORDER BY id DESC').all() }));
function validUser(body) {
  const name = str(body.name),email = str(body.email).toLowerCase(),role = body.role;
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !['admin', 'operator', 'client'].includes(role)) throw Error('Preencha nome, email e perfil válidos.');
  return { name, email, role };
}
app.post('/api/users', auth, admin, async (req, res) => {try {const u = validUser(req.body),temp = temporaryPassword();const id = (await db.prepare('INSERT INTO users(name,email,password_hash,role,must_change_password) VALUES(?,?,?,?,1)').run(u.name, u.email, hashPassword(temp), u.role)).lastInsertRowid;res.json({ user: userView(await db.prepare('SELECT * FROM users WHERE id=?').get(id)), temporary_password: temp });} catch (e) {fail(res, e.message.includes('UNIQUE') ? 409 : 400, e.message.includes('UNIQUE') ? 'Email já cadastrado.' : e.message);}});
app.patch('/api/users/:id', auth, admin, async (req, res) => {const id = Number(req.params.id),old = await db.prepare('SELECT * FROM users WHERE id=?').get(id);if (!old) return fail(res, 404, 'Usuário não encontrado.');try {const u = validUser({ ...old, ...req.body });const active = req.body.active === undefined ? old.active : Number(!!req.body.active);if (old.id === req.user.id && (u.role !== 'admin' || !active)) return fail(res, 400, 'Você não pode remover seu próprio acesso administrativo.');await db.prepare('UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?').run(u.name, u.email, u.role, active, id);await db.prepare('DELETE FROM sessions WHERE user_id=? AND user_id<>?').run(id, req.user.id);res.json({ ok: true });} catch (e) {fail(res, 400, e.message);}});
app.post('/api/users/:id/reset-password', auth, admin, async (req, res) => {const id = Number(req.params.id),u = await db.prepare('SELECT id FROM users WHERE id=?').get(id);if (!u) return fail(res, 404, 'Usuário não encontrado.');const temp = temporaryPassword();await db.prepare('UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?').run(hashPassword(temp), id);await db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);res.json({ temporary_password: temp });});

const ticketOptions = async () => normalizeTicketOptions(JSON.parse((await db.prepare('SELECT value FROM ticket_options WHERE id=1').get())?.value || '{}'));
function validateOptions(value) {
  if (!value || !Array.isArray(value.categories) || !Array.isArray(value.urgencies) || !Array.isArray(value.impacts) || !Array.isArray(value.statuses)) throw Error('Configuração inválida.');
  const names = (list, max = 80) => {if (!list.length || list.length > 50 || list.some((x) => typeof x !== 'string' || !x.trim() || x.trim().length > max) || new Set(list.map((x) => x.trim().toLowerCase())).size !== list.length) throw Error('Informe opções únicas e não vazias.');return list.map((x) => x.trim());};
  const categories = value.categories.map((c) => ({ name: names([c?.name])[0], subcategories: Array.isArray(c?.subcategories) && c.subcategories.length ? names(c.subcategories) : [] }));
  names(categories.map((c) => c.name));
  const result = { categories, urgencies: names(value.urgencies, 30), impacts: names(value.impacts, 30), statuses: names(value.statuses, 80) };
  for (const status of ['Aberto', 'Em atendimento', 'Resolvido']) if (!result.statuses.includes(status)) throw Error(`Mantenha o status ${status} para o fluxo do chamado.`);
  const config = normalizeTicketOptions(value);
  if (!Array.isArray(config.priorities)) throw Error('Configure as prioridades.');
  names(config.priorities.map((p) => p?.name), 30);
  result.priorities = config.priorities.map((p) => {
    const start = Number(p.start_minutes),resolve = Number(p.resolve_minutes);
    if (!Number.isInteger(start) || !Number.isInteger(resolve) || start < 1 || resolve < start || resolve > 525600) throw Error('SLA: informe minutos positivos; o prazo de finalizar deve ser igual ou maior que o de iniciar (máximo de um ano).');
    return { name: p.name.trim(), start_minutes: start, resolve_minutes: resolve };
  });
  const window = config.sla_window;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(window.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.end) || window.end <= window.start || !Array.isArray(window.days) || !window.days.length || window.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || new Set(window.days).size !== window.days.length) throw Error('Configure dias e uma janela comercial válida, com fim posterior ao início.');
  try {new Intl.DateTimeFormat('pt-BR', { timeZone: window.time_zone }).format();} catch {throw Error('Fuso horário inválido.');}
  result.sla_window = { start: window.start, end: window.end, days: window.days, time_zone: window.time_zone };
  if (!Array.isArray(config.complexities)) throw Error('Configure as complexidades.');
  result.complexities = names(config.complexities, 40);
  result.work_unit = names([config.work_unit], 30)[0];result.work_step = Number(config.work_step);
  if (!Number.isFinite(result.work_step) || result.work_step <= 0 || result.work_step > 10000) throw Error('Informe um incremento de trabalho positivo.');
  return result;
}
app.get('/api/ticket-options', auth, async (_req, res) => res.json({ options: await ticketOptions() }));
app.put('/api/ticket-options', auth, admin, async (req, res) => {try {const options = validateOptions(req.body);await db.prepare('INSERT INTO ticket_options(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(options));res.json({ options });} catch (e) {fail(res, 400, e.message);}});
const calculatedPriority = (urgency, impact, options) => {const u = options.urgencies.indexOf(urgency),i = options.impacts.indexOf(impact);return u === options.urgencies.length - 1 || i === options.impacts.length - 1 ? 'Alta' : u >= options.urgencies.length - 2 || i >= options.impacts.length - 2 ? 'Média' : 'Baixa';};
const priority = (urgency, impact, options) => {
  const name = calculatedPriority(urgency, impact, options);
  return options.priorities.find((p) => p.name === name)?.name || options.priorities[name === 'Alta' ? options.priorities.length - 1 : name === 'Média' ? Math.floor(options.priorities.length / 2) : 0].name;
};
function attachmentsInput(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) throw Error('Adicione no máximo 5 arquivos.');
  let total = 0;
  return value.map((file) => {
    const name = str(file?.name, 180).replace(/[\\/\x00-\x1f]/g, '_'),encoded = file?.data;
    if (!name || typeof encoded !== 'string' || !encoded || encoded.length > 13981016 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('Arquivo inválido ou maior que 10 MB.');
    const content = Buffer.from(encoded, 'base64');
    if (!content.length || content.length > 10 * 1024 * 1024 || content.toString('base64') !== encoded) throw Error('Arquivo inválido ou maior que 10 MB.');
    total += content.length;if (total > 25 * 1024 * 1024) throw Error('Os anexos devem somar no máximo 25 MB.');
    return { name, content, size: content.length, type: str(file.content_type, 100) || 'application/octet-stream' };
  });
}
async function planningInput(body, t, status) {
  const parse = (key, fallback) => {
    if (body[key] === undefined) return fallback;
    if (body[key] === null || body[key] === '') return null;
    if (typeof body[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/.test(body[key]) || !Number.isFinite(Date.parse(body[key]))) throw Error('Informe datas válidas com fuso horário.');
    const [year, month, day] = body[key].slice(0, 10).split('-').map(Number);
    if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== body[key].slice(0, 10)) throw Error('Data de calendário inválida.');
    return new Date(body[key]).toISOString().slice(0, 19).replace('T', ' ');
  };
  const now = new Date().toISOString().slice(0, 19).replace('T', ' '),closed = ['Resolvido', 'Cancelado'].includes(status);
  let started = parse('started_at', t.started_at),ended = closed && ['Resolvido', 'Cancelado'].includes(t.status) ? t.ended_at : null,expected = parse('expected_end_at', t.expected_end_at);
  if (!started && status !== 'Aberto' && status !== 'Cancelado') started = now;
  if (closed && !ended) ended = now;
  const config = await ticketOptions(),amount = body.work_amount === undefined ? t.work_amount : Number(body.work_amount),complexity = body.scope_complexity === undefined ? t.scope_complexity : str(body.scope_complexity, 40) || null,nextPriority = body.priority ?? t.priority;
  if (!Number.isFinite(amount)) throw Error('Informe uma quantidade de trabalho numérica.');
  if (complexity && !config.complexities.includes(complexity) && complexity !== t.scope_complexity) throw Error('Selecione uma complexidade válida.');
  if (!config.priorities.some((p) => p.name === nextPriority) && nextPriority !== t.priority) throw Error('Selecione uma prioridade válida.');
  return { started, ended, expected, amount, complexity, priority: nextPriority };
}
app.get('/api/tickets', auth, async (req, res) => {let where = '1=1',args = [];if (req.user.role === 'client') {where = 't.creator_id=?';args = [req.user.id];}const tickets = await db.prepare(`SELECT ${unreadCommentsSql} unread_comments,t.id,t.creator_id,t.assignee_id,t.subject,t.category,t.subcategory,t.status,t.priority,t.progress,t.started_at,t.expected_end_at,t.ended_at,t.work_amount,t.scope_complexity,t.created_at,t.updated_at,creator.name creator_name,u.name assignee_name FROM tickets t JOIN users creator ON creator.id=t.creator_id LEFT JOIN users u ON u.id=t.assignee_id WHERE ${where} ORDER BY t.updated_at DESC,t.id DESC`).all(notificationBaseline, req.user.id, req.user.id, ...args);res.json({ tickets });});
app.post('/api/tickets', auth, async (req, res) => {
  const b = req.body,subject = str(b.subject, 160),category = str(b.category, 80),subcategory = str(b.subcategory, 80),description = clean(b.description),urgency = str(b.urgency, 30),impact = str(b.impact, 30);
  if (!subject || !category || !description.replace(/<[^>]+>/g, '').trim() || !urgency || !impact) return fail(res, 400, 'Preencha assunto, categoria, urgência, impacto e descrição.');
  const options = await ticketOptions(),chosen = options.categories.find((c) => c.name === category);
  if (!chosen || subcategory && !chosen.subcategories.includes(subcategory) || !options.urgencies.includes(urgency) || !options.impacts.includes(impact)) return fail(res, 400, 'Selecione categoria, subcategoria, urgência e impacto válidos.');
  let files;try {files = attachmentsInput(b.attachments);} catch (e) {return fail(res, 400, e.message);}
  await db.exec('BEGIN IMMEDIATE');
  try {
    const id = Number((await db.prepare('INSERT INTO tickets(creator_id,subject,category,subcategory,urgency,impact,equipment,location,description,phone,contact_time,priority) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(req.user.id, subject, category, subcategory, urgency, impact, str(b.equipment, 160), str(b.location, 160), description, str(b.phone, 40), str(b.contact_time, 60), priority(urgency, impact, options))).lastInsertRowid);
    await db.prepare("INSERT INTO ticket_events(ticket_id,user_id,kind,body,progress) VALUES(?,?,'created',?,0)").run(id, req.user.id, 'Chamado aberto');
    const add = db.prepare('INSERT INTO ticket_attachments(ticket_id,user_id,name,content_type,size,content) VALUES(?,?,?,?,?,?)');
    for (const file of files) await add.run(id, req.user.id, file.name, file.type, file.size, file.content);
    await db.exec('COMMIT');res.json({ id });
  } catch (e) {await db.exec('ROLLBACK');throw e;}
});
app.get('/api/tickets/:id', auth, async (req, res) => {const ticket = await ticketFor(req, res);if (!ticket) return;const events = await db.prepare('SELECT e.*,u.name user_name,u.role user_role,(e.id>? AND e.user_id<>? AND r.event_id IS NULL) unread FROM ticket_events e JOIN users u ON u.id=e.user_id LEFT JOIN event_reads r ON r.event_id=e.id AND r.user_id=? WHERE e.ticket_id=? ORDER BY e.created_at,e.id').all(notificationBaseline, req.user.id, req.user.id, ticket.id);const attachments = await db.prepare('SELECT id,name,size,content_type,created_at FROM ticket_attachments WHERE ticket_id=? ORDER BY id').all(ticket.id);res.json({ ticket, events, attachments, sla: ticketSla(ticket, await ticketOptions()) });});
app.patch('/api/tickets/:id', auth, async (req, res) => {const t = await ticketFor(req, res);if (!t) return;const b = req.body;if (req.user.role === 'client') {const subject = str(b.subject, 160),description = clean(b.description);if (!subject || !description.replace(/<[^>]+>/g, '').trim()) return fail(res, 400, 'Informe assunto e descrição.');await db.prepare("UPDATE tickets SET subject=?,description=?,location=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(subject, description, b.location === undefined ? t.location : str(b.location, 160), t.id);const nextLocation = b.location === undefined ? t.location : str(b.location, 160);
    const changes = [['Assunto', t.subject, subject], ['Descrição', t.description, description], ['Local', t.location, nextLocation]].filter(([, old, next]) => old !== next).map(([label, old, next]) => label + ': ' + (old || 'Não informado') + ' → ' + (next || 'Não informado'));
    await db.prepare("INSERT INTO ticket_events(ticket_id,user_id,kind,body) VALUES(?,?,'edited',?)").run(t.id, req.user.id, changes.join(' · ') || 'Dados salvos sem alterações');} else {const status = b.status ?? t.status,progress = Number(b.progress ?? t.progress),assignee = b.assignee_id === undefined ? t.assignee_id : Number(b.assignee_id) || null;if (!((await ticketOptions()).statuses.includes(status) || status === t.status) || !Number.isInteger(progress) || progress < 0 || progress > 100) return fail(res, 400, 'Status ou progresso inválido.');if (status === 'Resolvido' && progress !== 100 && b.progress !== undefined) return fail(res, 400, 'Para fechar o chamado, conclua o progresso em 100%.');if (assignee) {const u = await db.prepare('SELECT role FROM users WHERE id=? AND active=1').get(assignee);if (!u || u.role === 'client') return fail(res, 400, 'Selecione um operador ativo.');}let plan;try {plan = await planningInput(b, t, status);} catch (e) {return fail(res, 400, e.message);}const nextProgress = status === 'Resolvido' ? 100 : progress;await db.prepare('UPDATE tickets SET status=?,progress=?,assignee_id=?,priority=?,started_at=?,expected_end_at=?,ended_at=?,work_amount=?,scope_complexity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, nextProgress, assignee, plan.priority, plan.started, plan.expected, plan.ended, plan.amount, plan.complexity, t.id);const operatorNames = new Map((await db.prepare('SELECT id,name FROM users').all()).map((u) => [u.id, u.name]));const operatorName = (id) => id ? operatorNames.get(id) || String(id) : 'Não atribuído';
    const dateValue = (value) => value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não definida';
const workUnit = (await ticketOptions()).work_unit;
const changes = [
    ['Status', t.status, status], ['Progresso', t.progress, nextProgress, (v) => v + '%'],
    ['Responsável', t.assignee_id, assignee, operatorName], ['Prioridade', t.priority, plan.priority],
    ['Início', t.started_at, plan.started, dateValue], ['Previsão de fim', t.expected_end_at, plan.expected, dateValue],
    ['Data final', t.ended_at, plan.ended, dateValue], ['Trabalho', t.work_amount, plan.amount, (v) => v + ' ' + workUnit],
    ['Complexidade', t.scope_complexity, plan.complexity, (v) => v || 'Não definida']].
    filter(([, old, next]) => old !== next).map(([label, old, next, format = (v) => v]) => label + ': ' + format(old) + ' → ' + format(next));
    const eventBody = [str(b.note, 2000), ...changes].filter(Boolean).join(' · ') || 'Andamento salvo sem alterações';
    await db.prepare('INSERT INTO ticket_events(ticket_id,user_id,kind,body,old_status,new_status,progress) VALUES(?,?,?,?,?,?,?)').run(t.id, req.user.id, 'update', eventBody, t.status, status, nextProgress);}res.json({ ok: true });});
app.post('/api/tickets/:id/comments', auth, async (req, res) => {const t = await ticketFor(req, res);if (!t) return;const body = clean(req.body.body);if (!body.replace(/<[^>]+>/g, '').trim()) return fail(res, 400, 'Escreva uma mensagem.');await db.prepare("INSERT INTO ticket_events(ticket_id,user_id,kind,body) VALUES(?,?,'comment',?)").run(t.id, req.user.id, body);await db.prepare('UPDATE tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(t.id);res.json({ ok: true });});
app.get('/api/tickets/:id/attachments/:attachmentId', auth, async (req, res) => {
  const t = await ticketFor(req, res);if (!t) return;
  const file = await db.prepare('SELECT * FROM ticket_attachments WHERE id=? AND ticket_id=?').get(Number(req.params.attachmentId), t.id);
  if (!file) return fail(res, 404, 'Anexo não encontrado.');
  res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(file.name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(Buffer.from(file.content));
});
app.post('/api/tickets/:id/read', auth, async (req, res) => {
  const ticket = await ticketFor(req, res);if (!ticket) return;
  const through = Number(req.body.through_event_id);
  if (!Number.isSafeInteger(through) || through < 1 || !(await db.prepare('SELECT 1 FROM ticket_events WHERE id=? AND ticket_id=?').get(through, ticket.id))) return fail(res, 400, 'Informe a última atualização exibida deste chamado.');
  await db.prepare(`INSERT INTO event_reads(user_id,event_id) SELECT ?,id FROM ticket_events WHERE ticket_id=? AND id<=? AND id>? AND user_id<>? ON CONFLICT(user_id,event_id) DO NOTHING`).run(req.user.id, ticket.id, through, notificationBaseline, req.user.id);
  res.json({ ok: true });
});
app.get('/api/notifications', auth, async (req, res) => {
  const access = req.user.role === 'client' ? ' AND t.creator_id=?' : '',args = [req.user.id, notificationBaseline, req.user.id, ...(req.user.role === 'client' ? [req.user.id] : [])];
  const notifications = (await db.prepare(`SELECT e.id,e.ticket_id,e.kind,e.body,e.new_status,e.progress,e.created_at,t.subject,u.name actor_name,(r.event_id IS NOT NULL) is_read
    FROM ticket_events e JOIN tickets t ON t.id=e.ticket_id JOIN users u ON u.id=e.user_id
    LEFT JOIN event_reads r ON r.event_id=e.id AND r.user_id=? WHERE e.id>? AND e.user_id<>?` + access + ` ORDER BY e.id DESC LIMIT 60`).all(...args)).map((n) => ({ ...n, is_read: !!n.is_read, preview: sanitizeHtml(n.body, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').slice(0, 180) }));
  const unread = (await db.prepare(`SELECT COUNT(*) n FROM ticket_events e JOIN tickets t ON t.id=e.ticket_id LEFT JOIN event_reads r ON r.event_id=e.id AND r.user_id=? WHERE e.id>? AND e.user_id<>? AND r.event_id IS NULL` + access).get(...args)).n;
  res.json({ notifications, unread_count: unread });
});
app.get('/api/dashboard', auth, admin, async (req, res) => {
  const now = Date.now(),to = req.query.to ?? dashboardDay(now);
  if (!validDashboardDay(to)) return fail(res, 400, 'Informe uma data final válida.');
  const from = req.query.from ?? shiftDay(to, -364),trendDays = Number(req.query.trend_days ?? 14);
  if (!validDashboardDay(from) || !validDashboardDay(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 3660 || ![14, 30, 90].includes(trendDays)) return fail(res, 400, 'Informe um período válido e uma evolução de 14, 30 ou 90 dias.');
  const tickets = await db.prepare(`SELECT ${unreadCommentsSql} unread_comments,t.*,creator.name creator_name,assignee.name assignee_name FROM tickets t JOIN users creator ON creator.id=t.creator_id LEFT JOIN users assignee ON assignee.id=t.assignee_id`).all(notificationBaseline, req.user.id, req.user.id);
  const users = await db.prepare("SELECT id,name,active FROM users WHERE role IN ('admin','operator')").all();
  res.json(buildDashboard(tickets, users, await ticketOptions(), { from, to, trendDays, now }));
});
app.get('/api/operators', auth, async (req, res) => {let users = await db.prepare("SELECT id,name,role FROM users WHERE active=1 AND role IN ('admin','operator') ORDER BY name").all();res.json({ operators: users });});

app.use('/api', (_req, res) => fail(res, 404, 'Recurso não encontrado.'));

const dist = path.join(root, 'dist');if (existsSync(dist)) {app.use(express.static(dist));app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));}
app.use((err, _req, res, _next) => {if (err.type === 'entity.too.large') return fail(res, 413, 'Os anexos devem somar no máximo 25 MB.');if (err.type === 'entity.parse.failed') return fail(res, 400, 'Requisição inválida.');console.error(err.message);fail(res, 500, 'Erro interno.');});
const port = Number(process.env.PORT || 3001);
const listener = app.listen(port, process.env.HOST, () => console.log(`Portal TI: http://localhost:${listener.address().port}`));
