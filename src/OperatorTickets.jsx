import React, {useEffect, useState} from 'react';
import {Ticket, Clock3, AlertTriangle, CircleCheck, Search, Filter, Plus, ChevronRight, ChevronLeft, MessageCircle} from 'lucide-react';
import './operator-tickets.css';

const emptyFilters={query:'',category:'',status:'',priority:'',assignee:'',pending:false};
const closed=t=>['Resolvido','Cancelado'].includes(t.status);

export default function OperatorTickets({tickets,options,mine,open,onNew,Badge,date}) {
  const [filters,setFilters]=useState(emptyFilters),[page,setPage]=useState(1);
  const set=(name,value)=>setFilters(old=>({...old,[name]:value}));
  useEffect(()=>setPage(1),[filters]);
  const normalized=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const query=normalized(filters.query.trim().replace(/^#/,''));
  const shown=tickets.filter(t=>(!query||normalized(`${String(t.id).padStart(5,'0')} ${t.subject} ${t.creator_name}`).includes(query))&&(!filters.category||t.category===filters.category)&&(!filters.status||(filters.status==='__closed'?closed(t):t.status===filters.status))&&(!filters.priority||t.priority===filters.priority)&&(!filters.assignee||(filters.assignee==='__none'?!t.assignee_id:String(t.assignee_id)===filters.assignee))&&(!filters.pending||t.unread_comments>0));
  const pageCount=Math.max(1,Math.ceil(shown.length/20)),currentPage=Math.min(page,pageCount),offset=(currentPage-1)*20;
  const assignees=[...new Map(tickets.filter(t=>t.assignee_id).map(t=>[t.assignee_id,{id:t.assignee_id,name:t.assignee_name}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const metrics=[
    {label:'Total de chamados',value:tickets.length,Icon:Ticket,tone:'violet'},
    {label:'Em atendimento',value:tickets.filter(t=>t.status==='Em atendimento').length,Icon:Clock3,tone:'blue'},
    {label:'Alta prioridade',value:tickets.filter(t=>t.priority==='Alta').length,Icon:AlertTriangle,tone:'red'},
    {label:'Encerrados',value:tickets.filter(closed).length,Icon:CircleCheck,tone:'green'}
  ];
  return <section className="operator-tickets">
    <div className="page-heading operator-heading"><div><h1>{mine?'Meus chamados':'Chamados'}</h1><p>{mine?'Acompanhe os chamados sob sua responsabilidade.':'Visualize e acompanhe todos os chamados de suporte.'}</p></div><button className="primary" onClick={onNew}><Plus size={20}/>Novo chamado</button></div>
    <div className="operator-metrics">{metrics.map(({label,value,Icon,tone})=><div className="operator-metric" key={label}><span className={'operator-metric-icon '+tone}><Icon size={24}/></span><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>
    <div className="operator-filters">
      <div className="operator-search"><Search size={18}/><input aria-label="Buscar chamados por solicitante, assunto ou ID" placeholder="Buscar chamados por solicitante, assunto ou ID..." value={filters.query} onChange={e=>set('query',e.target.value)}/></div>
      <label>Categoria<select value={filters.category} onChange={e=>set('category',e.target.value)}><option value="">Todas</option>{[...new Set([...options.categories.map(c=>c.name),...tickets.map(t=>t.category)])].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Status<select value={filters.status} onChange={e=>set('status',e.target.value)}><option value="">Todos</option>{[...new Set([...options.statuses,...tickets.map(t=>t.status)])].map(x=><option key={x}>{x}</option>)}<option value="__closed">Encerrados</option></select></label>
      <label>Prioridade<select value={filters.priority} onChange={e=>set('priority',e.target.value)}><option value="">Todas</option>{[...new Set([...options.priorities.map(p=>p.name),...tickets.map(t=>t.priority)])].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Responsável<select value={filters.assignee} onChange={e=>set('assignee',e.target.value)}><option value="">Todos</option><option value="__none">Não atribuído</option>{assignees.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
      <button className="operator-clear" onClick={()=>{setFilters({...emptyFilters});setPage(1)}}><Filter size={16}/>Limpar filtros</button>
    </div>
    <div className="operator-list-meta"><span>{shown.length} {shown.length===1?'chamado encontrado':'chamados encontrados'}</span><label><input type="checkbox" checked={filters.pending} onChange={e=>set('pending',e.target.checked)}/><MessageCircle size={14}/>Conversa pendente <span>({tickets.filter(t=>t.unread_comments>0).length})</span></label></div>
    <div className="operator-table-wrap"><div className="table-scroll"><table className="operator-table"><thead><tr><th>ID</th><th>Solicitante</th><th>Assunto</th><th>Categoria</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Atualização</th><th aria-label="Abrir chamado"/></tr></thead><tbody>{shown.slice(offset,offset+20).map(t=><tr key={t.id} onClick={()=>open(t.id)}><td className="ticket-id"><button className="operator-ticket-link" onClick={e=>{e.stopPropagation();open(t.id)}} aria-label={`Abrir chamado ${t.id}`}>#{String(t.id).padStart(5,'0')}</button>{t.unread_comments>0&&<span className="ticket-unread" title={`${t.unread_comments} mensagens não vistas`} aria-label={`${t.unread_comments} mensagens não vistas`}><MessageCircle size={12}/>{t.unread_comments}</span>}</td><td><span className="operator-cell-text" title={t.creator_name}>{t.creator_name}</span></td><td><span className="operator-subject" title={t.subject}>{t.subject}</span></td><td><span className="tag">{t.category}</span></td><td><Badge value={t.status}/></td><td><Badge value={t.priority} type="priority"/></td><td><span className="operator-cell-text" title={t.assignee_name||'Não atribuído'}>{t.assignee_name||'Não atribuído'}</span></td><td className="operator-date">{date(t.updated_at)}</td><td><ChevronRight size={16}/></td></tr>)}</tbody></table>{!shown.length&&<div className="empty">Nenhum chamado encontrado com esses filtros.</div>}</div><div className="operator-pagination"><span>Mostrando {shown.length?offset+1:0}–{Math.min(offset+20,shown.length)} de {shown.length} chamados</span><div><button aria-label="Página anterior" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={16}/></button><span>{currentPage} / {pageCount}</span><button aria-label="Próxima página" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}><ChevronRight size={16}/></button></div></div></div>
  </section>;
}
