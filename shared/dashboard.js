import { businessMinutes, ticketSla } from './ticket-options.js';

const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const timestamp = value => value ? Date.parse(value.replace(' ', 'T') + 'Z') : null;
export function dashboardDay(value) {
  const parts = Object.fromEntries(localDay.formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export const shiftDay = (day, amount) => new Date(Date.parse(day + 'T12:00:00Z') + amount * 86400000).toISOString().slice(0, 10);
export function validDashboardDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
const metric = (value, previous) => ({ value, previous, delta: value != null && previous ? Math.round((value - previous) / previous * 100) : null });

export function buildDashboard(tickets, users, options, { from, to, trendDays = 14, now = Date.now() }) {
  const periodDays = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const previousTo = shiftDay(from, -1), previousFrom = shiftDay(from, -periodDays);
  const rows = tickets.map(ticket => ({ ...ticket, openedDay: dashboardDay(timestamp(ticket.created_at)), endedDay: ticket.ended_at ? dashboardDay(timestamp(ticket.ended_at)) : null }));
  const inside = (day, start = from, end = to) => day != null && day >= start && day <= end;
  const current = rows.filter(t => inside(t.openedDay)), previous = rows.filter(t => inside(t.openedDay, previousFrom, previousTo));
  const resolved = rows.filter(t => t.status === 'Resolvido' && inside(t.endedDay));
  const previousResolved = rows.filter(t => t.status === 'Resolvido' && inside(t.endedDay, previousFrom, previousTo));
  const average = list => list.length ? Math.round(list.reduce((sum, t) => sum + businessMinutes(timestamp(t.created_at), timestamp(t.ended_at), options.sla_window), 0) / list.length) : null;
  const avg = average(resolved), previousAvg = average(previousResolved);
  const countBy = (list, field, name) => list.filter(t => t[field] === name).length;
  const categoryNames = [...new Set([...options.categories.map(c => c.name), ...current.map(t => t.category)])];
  const categories = categoryNames.map(name => {
    const list = current.filter(t => t.category === name), config = options.categories.find(c => c.name === name);
    const subNames = [...new Set([...(config?.subcategories || []), ...list.map(t => t.subcategory || '').filter(Boolean)])];
    const subcategories = subNames.map(sub => ({ name: sub, total: countBy(list, 'subcategory', sub), configured: !!config?.subcategories.includes(sub) }));
    const without = list.filter(t => !t.subcategory).length;
    if (without) subcategories.push({ name: '', total: without, configured: false });
    return { name, total: list.length, configured: !!config, subcategories };
  });
  const trendFrom = [from, shiftDay(to, -trendDays + 1)].sort().at(-1), trend = [];
  for (let day = trendFrom; day <= to; day = shiftDay(day, 1)) {
    trend.push({ date: day, opened: countBy(rows, 'openedDay', day), in_progress: rows.filter(t=>t.openedDay===day&&t.status==='Em atendimento').length, resolved: countBy(rows.filter(t => t.status === 'Resolvido'), 'endedDay', day) });
  }
  const sla = { start: { within: 0, breached: 0, pending: 0, unconfigured: 0 }, resolution: { within: 0, breached: 0, pending: 0, unconfigured: 0 } };
  for (const ticket of current) {
    const result = ticketSla(ticket, options, now);
    for (const key of ['start', 'resolution']) {
      const value = result[key];
      sla[key][value.target_minutes == null ? 'unconfigured' : value.breached ? 'breached' : value.finished ? 'within' : 'pending']++;
    }
  }
  const collaborators = users.map(user => ({ id: user.id, name: user.name, active: !!user.active,
    resolved: resolved.filter(t => t.assignee_id === user.id).length,
    in_progress: current.filter(t => t.assignee_id === user.id && t.status === 'Em atendimento').length,
    waiting: current.filter(t => t.assignee_id === user.id && t.status === 'Aguardando cliente').length,
  })).sort((a, b) => b.resolved - a.resolved || b.in_progress - a.in_progress || a.name.localeCompare(b.name));
  return {
    period: { from, to, previous_from: previousFrom, previous_to: previousTo, days: periodDays },
    metrics: {
      total: metric(current.length, previous.length),
      in_progress: metric(countBy(current, 'status', 'Em atendimento'), countBy(previous, 'status', 'Em atendimento')),
      resolved: metric(resolved.length, previousResolved.length),
      average_resolution: { ...metric(avg, previousAvg), unit: 'business_minutes', sample_size: resolved.length },
    },
    trend, categories, collaborators, sla,
    statuses: [...new Set([...options.statuses, ...current.map(t => t.status)])].map(name => ({ name, total: countBy(current, 'status', name) })),
    priorities: [...new Set([...options.priorities.map(p => p.name), ...current.map(t => t.priority)])].map(name => ({ name, total: countBy(current, 'priority', name) })),
    recent: [...current].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, 5),
    updated_at: new Date(now).toISOString(),
  };
}
