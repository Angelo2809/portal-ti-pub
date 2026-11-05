import React, { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { ticketSla } from '../shared/ticket-options.js';

const localDate = value => {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
export const planningDraft = ticket => ({
  priority: ticket.priority,
  started_at: localDate(ticket.started_at),
  expected_end_at: localDate(ticket.expected_end_at),
  work_amount: ticket.work_amount ?? 0,
  scope_complexity: ticket.scope_complexity || '',
});
export const planningBody = draft => ({
  ...draft,
  ...Object.fromEntries(['started_at', 'expected_end_at'].map(key => [key,draft[key]?new Date(draft[key]).toISOString():null])),
});
export function TicketPlanningFields({ draft, setDraft, options }) {
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const setDate = (key, value) => setDraft(d => ({...d,[key]:value ? value+'T'+(d[key]?.slice(11)|| (key==='expected_end_at'?'23:59:59':localDate(new Date().toISOString().slice(0,19).replace('T',' ')).slice(11))) : ''}));
  return <div className="planning-fields">
    <div className="form-row">
      <label>Prioridade<select value={draft.priority} onChange={e => set('priority', e.target.value)}>
        {[...new Set([...options.priorities.map(p => p.name), draft.priority])].map(name => <option key={name}>{name}</option>)}
      </select></label>
      <label>Complexidade do escopo<select value={draft.scope_complexity} onChange={e => set('scope_complexity', e.target.value)}>
        <option value="">Não definida</option>
        {[...new Set([...options.complexities, ...(draft.scope_complexity ? [draft.scope_complexity] : [])])].map(name => <option key={name}>{name}</option>)}
      </select></label>
    </div>
    <div className="form-row">
      <label>Data de início<input type="date" value={draft.started_at.slice(0,10)} onChange={e => setDate('started_at', e.target.value)} /></label>
      <label>Data prevista de fim<input type="date" value={draft.expected_end_at.slice(0,10)} onChange={e => setDate('expected_end_at', e.target.value)} /></label>
    </div>
    <div className="form-row">
      <label>Quantidade de trabalho ({options.work_unit})<input type="number" step="any" value={draft.work_amount} onChange={e => set('work_amount', e.target.value)} /></label>
    </div>
    <p className="hint">Selecione apenas a data. O início é registrado automaticamente ao iniciar o atendimento.</p>
  </div>;
}
const duration = minutes => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
export function SlaSummary({ ticket, options }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const sla = ticketSla(ticket, options, now);
  return <div className="sla-compact-grid" aria-label="SLAs do chamado">{[['start', 'SLA de início'], ['resolution', 'SLA de finalização']].map(([key, title]) => {
    const value = sla[key], known = value.target_minutes != null;
    const label = !known ? 'Sem meta' : value.breached ? 'Fora do SLA' : 'Dentro do SLA';
    return <div className={'card sla-compact-card ' + (!known ? 'no-target' : value.breached ? 'breached' : 'within')} key={key} title={'Contagem em horas comerciais: '+options.sla_window.start+' às '+options.sla_window.end+' · '+options.sla_window.time_zone}>
      <div className="sla-compact-title"><Clock3 size={14}/><span>{title}</span></div>
      <div className="sla-compact-time"><strong>{duration(value.elapsed_minutes)}</strong><small> / {known ? duration(value.target_minutes)+' úteis' : 'sem meta'}</small></div>
      <span className="sla-compact-status"><i/>{label}</span>
    </div>;
  })}</div>;
}
export function TicketScheduleSummary({ ticket, options }) {
  return <div className="detail-meta planning-summary">{[['started_at', 'INÍCIO'], ['expected_end_at', 'PREVISÃO DE FIM'], ['ended_at', 'DATA FINAL']].map(([key, label]) => <div key={key}><small>{label}</small><strong>{ticket[key] ? new Date(ticket[key].replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR') : 'Não definida'}</strong></div>)}<div><small>TRABALHO / COMPLEXIDADE</small><strong>{ticket.work_amount || 0} {options.work_unit} · {ticket.scope_complexity || 'Não definida'}</strong></div></div>;
}
export function SlaSettings({ draft, setDraft }) {
  const setPriority = (index, key, value) => setDraft(d => ({ ...d, priorities: d.priorities.map((p, i) => i === index ? { ...p, [key]: value } : p) }));
  const setWindow = (key, value) => setDraft(d => ({ ...d, sla_window: { ...d.sla_window, [key]: value } }));
  return <section className="sla-settings"><h4>Prioridades e metas de SLA</h4><p>Defina as metas em minutos úteis. Os dois prazos contam desde a abertura, apenas dentro da janela comercial. As metas e a janela se aplicam aos chamados existentes. Ao remover uma prioridade, seus chamados antigos ficam sem meta até a prioridade ser alterada.</p>
    <div className="sla-priority-header"><span>Prioridade</span><span>Iniciar em (min)</span><span>Finalizar em (min)</span><span /></div>
    {draft.priorities.map((p, i) => <div className="sla-priority-row" key={i}><input aria-label={`Prioridade ${i + 1}`} required maxLength={30} value={p.name} onChange={e => setPriority(i, 'name', e.target.value)} /><input aria-label={`SLA de início ${p.name}`} required type="number" min="1" max="525600" value={p.start_minutes} onChange={e => setPriority(i, 'start_minutes', Number(e.target.value))} /><input aria-label={`SLA de finalização ${p.name}`} required type="number" min="1" max="525600" value={p.resolve_minutes} onChange={e => setPriority(i, 'resolve_minutes', Number(e.target.value))} /><button type="button" className="icon-plain" aria-label={`Remover prioridade ${p.name}`} disabled={draft.priorities.length === 1} onClick={() => setDraft(d => ({ ...d, priorities: d.priorities.filter((_, j) => i !== j) }))}>×</button></div>)}
    <button type="button" className="secondary" onClick={() => setDraft(d => ({ ...d, priorities: [...d.priorities, { name: '', start_minutes: 60, resolve_minutes: 480 }] }))}>Adicionar prioridade</button>
    <h4>Janela comercial do SLA</h4><div className="form-row"><label>Início do expediente<input required type="time" value={draft.sla_window.start} onChange={e => setWindow('start', e.target.value)} /></label><label>Fim do expediente<input required type="time" value={draft.sla_window.end} onChange={e => setWindow('end', e.target.value)} /></label></div>
    <div className="business-days">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => <label className="check-line" key={day}><input type="checkbox" checked={draft.sla_window.days.includes(i)} onChange={e => setWindow('days', e.target.checked ? [...draft.sla_window.days, i].sort() : draft.sla_window.days.filter(d => d !== i))} />{day}</label>)}</div>
    <label>Fuso horário<select value={draft.sla_window.time_zone} onChange={e => setWindow('time_zone', e.target.value)}>{['America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha'].map(zone => <option key={zone}>{zone}</option>)}</select></label>
    <p className="hint">O tempo aguardando cliente também conta dentro da janela. Fins de semana contam apenas se selecionados.</p>
    <h4>Quantidade de trabalho e complexidade</h4><div className="form-row"><label>Unidade de trabalho<input required maxLength={30} value={draft.work_unit} onChange={e => setDraft(d => ({ ...d, work_unit: e.target.value }))} placeholder="Ex.: horas, pontos, tarefas" /></label><label>Incremento da quantidade<input required type="number" min="0.001" max="10000" step="any" value={draft.work_step} onChange={e => setDraft(d => ({ ...d, work_step: Number(e.target.value) }))} /></label></div>
    {draft.complexities.map((name, i) => <div className="option-line" key={i}><input required maxLength={40} aria-label={`Complexidade ${i + 1}`} value={name} onChange={e => setDraft(d => ({ ...d, complexities: d.complexities.map((x, j) => i === j ? e.target.value : x) }))} /><button type="button" className="icon-plain" disabled={draft.complexities.length === 1} aria-label={`Remover complexidade ${name}`} onClick={() => setDraft(d => ({ ...d, complexities: d.complexities.filter((_, j) => i !== j) }))}>×</button></div>)}<button type="button" className="secondary" onClick={() => setDraft(d => ({ ...d, complexities: [...d.complexities, ''] }))}>Adicionar complexidade</button>
  </section>;
}
