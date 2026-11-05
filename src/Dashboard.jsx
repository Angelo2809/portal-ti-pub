import React, { useEffect, useId, useState } from 'react';
import { Activity, ArrowDown, ArrowRight, ArrowUp, CalendarDays, ChevronDown, ChevronRight, CircleCheck, Clock3, Headphones, Mail, Monitor, MoreHorizontal, Network, Printer, Settings, Ticket, UserRound } from 'lucide-react';
import { dashboardDay, shiftDay } from '../shared/dashboard.js';
import './dashboard.css';

const number = value => value.toLocaleString('pt-BR');
const initials = name => name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
const shortDate = day => day.slice(8, 10) + '/' + day.slice(5, 7);
const fullDate = day => shortDate(day) + '/' + day.slice(0, 4);
const duration = minutes => minutes == null ? '—' : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
const colors = ['#007cff', '#00b886', '#ffac38', '#f34f74', '#8197bc', '#9060eb'];
const statusColor = name => ({ Resolvido: '#00b886', 'Em atendimento': '#258cff', 'Aguardando cliente': '#ffac38', Aberto: '#f34f74', Cancelado: '#8197bc' }[name] || '#9060eb');
const categoryIcon = name => ({ Sistemas: Settings, 'Rede e Conectividade': Network, 'Suporte ao Usuário': UserRound, Hardware: Monitor, 'E-mail': Mail, Impressoras: Printer }[name] || MoreHorizontal);

function curve(points) {
  return points.map(([x, y], i) => i === 0 ? `M${x},${y}` : `C${(points[i - 1][0] + x) / 2},${points[i - 1][1]} ${(points[i - 1][0] + x) / 2},${y} ${x},${y}`).join(' ');
}
function Sparkline({ values, color }) {
  const id = useId().replaceAll(':', ''), max = Math.max(1, ...values);
  const points = values.map((v, i) => [i * 90 / Math.max(1, values.length - 1), 33 - v / max * 28]);
  if (!points.length) return null;
  const line = curve(points);
  return <svg className="dash-sparkline" viewBox="0 0 90 40" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={`${line} L90,40 L0,40 Z`} fill={`url(#${id})`} /><path d={line} stroke={color} fill="none" strokeWidth="1.8" /></svg>;
}
function MetricCard({ title, metric, Icon, tone, values, format = number, explanation, lowerIsBetter = false }) {
  const down = metric.delta < 0, Arrow = down ? ArrowDown : ArrowUp;
  return <div className={'dash-metric dash-tone-' + tone} title={explanation}><div className="dash-metric-icon"><Icon size={29} /></div><div className="dash-metric-main"><span>{title}</span><strong>{metric.value == null ? '—' : format(metric.value)}</strong><div className={'dash-delta ' + (lowerIsBetter ? down ? 'good' : 'neutral' : 'neutral')}>{metric.delta == null ? <small>{metric.previous ? 'Sem dados no período' : 'Sem base no período anterior'}</small> : <><Arrow size={16} /><b>{metric.delta > 0 ? '+' : ''}{metric.delta}%</b><small>em relação ao período anterior</small></>}</div></div><Sparkline values={values} color={tone === 'green' ? '#00b886' : tone === 'purple' ? '#8552ff' : '#007cff'} /></div>;
}
function EvolutionChart({ values }) {
  const id = useId().replaceAll(':', ''), max = Math.max(5, Math.ceil(Math.max(0, ...values.flatMap(v => [v.opened, v.resolved])) / 5) * 5);
  const width = 660, height = 230, left = 34, right = 12, top = 14, bottom = 32, plotHeight = height - top - bottom;
  const points = key => values.map((v, i) => [left + i / Math.max(1, values.length - 1) * (width - left - right), top + (1 - v[key] / max) * plotHeight]);
  const interval = Math.max(1, Math.ceil(values.length / 14));
  return <svg className="dash-evolution-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução diária: chamados abertos e resolvidos"><defs>{['opened', 'resolved'].map((key, i) => <linearGradient key={key} id={id + key} x1="0" y1="0" x2="0" y2="1"><stop stopColor={colors[i]} stopOpacity=".22" /><stop offset="1" stopColor={colors[i]} stopOpacity="0" /></linearGradient>)}</defs>
    {[0, 1, 2, 3, 4, 5].map(i => <g key={i}><line x1={left} x2={width - right} y1={top + i * plotHeight / 5} y2={top + i * plotHeight / 5} stroke="#e7eefb" /><text x={left - 10} y={top + i * plotHeight / 5 + 4} textAnchor="end">{Math.round(max * (1 - i / 5))}</text></g>)}
    {values.map((v, i) => i % interval === 0 || i === values.length - 1 ? <g key={v.date}><line x1={points('opened')[i][0]} x2={points('opened')[i][0]} y1={top} y2={height - bottom} stroke="#edf2fb" /><text x={points('opened')[i][0]} y={height - 10} textAnchor="middle">{shortDate(v.date)}</text></g> : null)}
    {['opened', 'resolved'].map((key, i) => { const list = points(key); if (!list.length) return null; return <g key={key}><path d={`${curve(list)} L${list.at(-1)[0]},${height - bottom} L${list[0][0]},${height - bottom} Z`} fill={`url(#${id + key})`} /><path d={curve(list)} fill="none" stroke={colors[i]} strokeWidth="2" />{list.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={values.length > 30 ? 2 : 4} fill={colors[i]} stroke="white" strokeWidth="1"><title>{fullDate(values[index].date)}: {values[index][key]} {key === 'opened' ? 'abertos' : 'resolvidos'}</title></circle>)}</g>; })}
  </svg>;
}
function Donut({ entries, center, caption }) {
  const total = entries.reduce((sum, e) => sum + e.total, 0), circumference = 2 * Math.PI * 63;
  let offset = 0;
  return <div className="dash-donut"><svg viewBox="0 0 160 160" role="img" aria-label={caption + ': ' + entries.map(e => `${e.name} ${e.total}`).join(', ')}><circle cx="80" cy="80" r="63" fill="none" stroke="#eaf0fa" strokeWidth="23" />{entries.filter(e => e.total).map(e => { const length = e.total / total * circumference, previous = offset; offset += length; return <circle key={e.name} cx="80" cy="80" r="63" fill="none" stroke={e.color} strokeWidth="23" strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`} strokeDashoffset={-previous} transform="rotate(-90 80 80)"><title>{e.name}: {e.total}</title></circle>; })}<text className="dash-donut-value" x="80" y="79" textAnchor="middle">{center}</text><text className="dash-donut-caption" x="80" y="98" textAnchor="middle">{caption}</text></svg></div>;
}
function Legend({ entries }) {
  const total = entries.reduce((sum, e) => sum + e.total, 0);
  return <div className="dash-legend">{entries.map(e => <div key={e.name}><i style={{ background: e.color }} /><span>{e.name}</span><b>{number(e.total)}</b><small>{total ? Math.round(e.total / total * 100) : 0}%</small></div>)}</div>;
}
function DateRange({ range, setRange }) {
  const [draft, setDraft] = useState(range), [error, setError] = useState('');
  const today = dashboardDay(Date.now());
  const choose = from => { const next = { from, to: today }; setRange(next); setDraft(next); setError(''); };
  return <details className="dash-date-range"><summary><CalendarDays size={17} /><span>{fullDate(range.from)} – {fullDate(range.to)}</span><ChevronDown size={16} /></summary><div className="dash-date-popover"><div className="dash-date-presets"><button type="button" onClick={e => { choose(today.slice(0, 8) + '01'); e.currentTarget.closest('details').open = false; }}>Este mês</button><button type="button" onClick={e => { choose(shiftDay(today, -29)); e.currentTarget.closest('details').open = false; }}>Últimos 30 dias</button><button type="button" onClick={e => { choose(shiftDay(today, -364)); e.currentTarget.closest('details').open = false; }}>Últimos 12 meses</button></div><form onSubmit={e => { e.preventDefault(); if (draft.from > draft.to) { setError('A data inicial deve ser anterior à final.'); return; } setRange(draft); setError(''); e.currentTarget.closest('details').open = false; }}><label>De<input required type="date" value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label><label>Até<input required type="date" value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>{error && <p role="alert">{error}</p>}<button className="primary">Aplicar período</button></form></div></details>;
}
export default function Dashboard({ api, options, refreshKey, openTicket, onAll, onCategory, TicketTable }) {
  const [range, setRange] = useState(() => { const today = dashboardDay(Date.now()); return { from: shiftDay(today, -364), to: today }; });
  const [trendDays, setTrendDays] = useState(14), [teamLimit, setTeamLimit] = useState(5), [expanded, setExpanded] = useState(null), [categoryFilter, setCategoryFilter] = useState(''), [slaKind, setSlaKind] = useState('resolution');
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const refresh = async () => { try { const result = await api(`/dashboard?from=${range.from}&to=${range.to}&trend_days=${trendDays}`); if (live) { setData(result); setError(''); } } catch (e) { if (live) setError(e.message); } finally { if (live) setLoading(false); } };
    refresh(); const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    return () => { live = false; clearInterval(timer); };
  }, [range.from, range.to, trendDays, refreshKey]);
  if (!data) return <div className="executive-dashboard"><div className="dash-heading"><div><h1>Dashboard de Chamados</h1><p>{error || 'Carregando indicadores do atendimento...'}</p></div><DateRange range={range} setRange={setRange} /></div></div>;
  const statuses = [...data.statuses].sort((a, b) => b.total - a.total).map(s => ({ ...s, color: statusColor(s.name) }));
  const totals = data.sla[slaKind], slaEntries = [{ name: 'Dentro do prazo', total: totals.within, color: '#00b886' }, { name: 'Fora do prazo', total: totals.breached, color: '#f34f74' }, { name: 'Em andamento', total: totals.pending, color: '#258cff' }, { name: 'Sem meta', total: totals.unconfigured, color: '#8197bc' }];
  const evaluated = totals.within + totals.breached, compliance = evaluated ? Math.round(totals.within / evaluated * 100) + '%' : '—';
  const categories = data.categories.filter(c => !categoryFilter || c.name === categoryFilter), maxCategory = Math.max(1, ...data.categories.map(c => c.total)), maxTeam = Math.max(1, ...data.collaborators.map(c => c.resolved)), maxPriority = Math.max(1, ...data.priorities.map(p => p.total));
  return <div className="executive-dashboard" aria-busy={loading}><div className="dash-heading"><div><h1>Dashboard de Chamados</h1><p>Visão geral do atendimento de TI. Acompanhe métricas, desempenho e indicadores.</p></div><DateRange range={range} setRange={setRange} /></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="dash-metrics">
      <MetricCard title="Total de chamados" metric={data.metrics.total} Icon={Ticket} tone="blue" values={data.trend.map(v => v.opened)} explanation="Chamados abertos no período selecionado, comparados com um período anterior de igual duração." />
      <MetricCard title="Em atendimento" metric={data.metrics.in_progress} Icon={Headphones} tone="cyan" values={data.trend.map(v => v.in_progress)} explanation="Situação atual dos chamados abertos no período. Comparação com a situação atual dos chamados abertos no período anterior." />
      <MetricCard title="Resolvidos no período" metric={data.metrics.resolved} Icon={CircleCheck} tone="green" values={data.trend.map(v => v.resolved)} explanation="Chamados com data final dentro do período, inclusive os abertos antes dele." />
      <MetricCard title="Tempo médio de resolução" metric={data.metrics.average_resolution} Icon={Clock3} tone="purple" values={[]} format={duration} lowerIsBetter explanation="Média de horas comerciais entre abertura e data final dos chamados resolvidos no período, usando a janela de SLA configurada." />
    </div>
    <div className="dash-first-row">
      <section className="dash-panel dash-evolution"><div className="dash-panel-heading"><div><h3>Evolução de chamados</h3><p>Comparativo entre abertos e resolvidos no período</p></div><select aria-label="Período da evolução" value={trendDays} onChange={e => setTrendDays(Number(e.target.value))}>{[14, 30, 90].map(days => <option key={days} value={days}>Últimos {days} dias</option>)}</select></div><div className="dash-chart-key"><span><i style={{ background: '#007cff' }} />Abertos</span><span><i style={{ background: '#00b886' }} />Resolvidos</span></div><EvolutionChart values={data.trend} /></section>
      <section className="dash-panel"><div className="dash-panel-heading"><h3>Distribuição por status</h3></div><div className="dash-donut-layout"><Donut entries={statuses} center={number(data.metrics.total.value)} caption="Chamados" /><Legend entries={statuses} /></div></section>
      <section className="dash-panel dash-categories"><div className="dash-panel-heading"><h3>Chamados por categoria</h3><select aria-label="Filtrar categorias" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setExpanded(e.target.value || null); }}><option value="">Todas</option>{data.categories.map(c => <option key={c.name}>{c.name}</option>)}</select></div><div className="dash-category-list">{categories.map((category, index) => { const Icon = categoryIcon(category.name), isOpen = expanded === category.name; return <div className="dash-category-group" key={category.name}><button type="button" className={'dash-category-row ' + (isOpen ? 'expanded' : '')} aria-expanded={isOpen} aria-controls={'dash-subcategories-' + index} onClick={() => setExpanded(isOpen ? null : category.name)}><span className="dash-category-icon"><Icon size={17} /></span><span className="dash-category-name">{category.name}</span><span className="dash-horizontal-track"><i style={{ width: category.total / maxCategory * 100 + '%' }} /></span><b>{category.total}</b><ChevronRight className="dash-category-chevron" size={13} /></button>{isOpen && <div className="dash-subcategories" id={'dash-subcategories-' + index}><button type="button" className="dash-category-all" onClick={() => onCategory(category.name, undefined, range)}>Ver chamados de {category.name}<ArrowRight size={12} /></button>{category.subcategories.length ? category.subcategories.map(sub => <button type="button" key={sub.name} className="dash-subcategory-row" onClick={() => onCategory(category.name, sub.name, range)}><span>{sub.name || 'Sem subcategoria'}{!sub.configured && sub.name && <small>Histórico</small>}</span><b>{sub.total}</b><ChevronRight size={12} /></button>) : <p>Nenhuma subcategoria configurada.</p>}</div>}</div>; })}</div></section>
    </div>
    <div className="dash-second-row">
      <section className="dash-panel"><div className="dash-panel-heading"><h3>Prioridade dos chamados</h3></div><div className="dash-priority-chart">{data.priorities.map((priority, i) => <div className="dash-priority-column" key={priority.name}><div className="dash-priority-bar-space"><div style={{ height: Math.max(2, priority.total / maxPriority * 100) + '%', background: ['#73dcb9', '#ffc269', '#ff8aa3', '#c4a2ff'][i % 4] }}><b>{priority.total}</b></div></div><span>{priority.name}</span></div>)}</div></section>
      <section className="dash-panel"><div className="dash-panel-heading"><h3>Desempenho da equipe</h3><select aria-label="Quantidade de colaboradores" value={teamLimit} onChange={e => setTeamLimit(Number(e.target.value))}><option value={5}>Top 5</option><option value={10}>Top 10</option><option value={999}>Todos</option></select></div><div className="dash-team">{data.collaborators.slice(0, teamLimit).map(user => <div className="dash-team-row" key={user.id} title={`${user.resolved} resolvidos no período; ${user.in_progress} em atendimento; ${user.waiting} aguardando cliente`}><span className="avatar small">{initials(user.name)}</span><span>{user.name}</span><span className="dash-horizontal-track"><i style={{ width: user.resolved / maxTeam * 100 + '%' }} /></span><b>{user.resolved}</b></div>)}</div><p className="dash-panel-footnote">Chamados resolvidos no período por responsável.</p></section>
      <section className="dash-panel"><div className="dash-panel-heading"><h3>SLA de atendimento</h3><select aria-label="Tipo de SLA" value={slaKind} onChange={e => setSlaKind(e.target.value)}><option value="resolution">Finalização</option><option value="start">Início</option></select></div><div className="dash-donut-layout dash-sla-layout"><Donut entries={slaEntries} center={compliance} caption="Dentro do SLA" /><Legend entries={slaEntries} /></div><p className="dash-panel-footnote">Índice entre atendimentos concluídos e SLAs já ultrapassados. Somente horas comerciais.</p></section>
    </div>
    <div className="dash-recent"><TicketTable title="Últimos chamados abertos" tickets={data.recent} options={options} staff open={openTicket} onAll={onAll} /></div>
    <p className="dash-update"><Activity size={12} />Atualizado às {new Date(data.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Atualização automática a cada minuto · Distribuições consideram chamados abertos no período.</p>
  </div>;
}
