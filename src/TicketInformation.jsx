import React from 'react';
import {UserRound, UsersRound, Flag, CalendarDays, CalendarClock, CalendarCheck, Monitor, Settings, MapPin, FileText, Mail, Network, Printer, Layers} from 'lucide-react';
import './ticket-information.css';

const categoryIcon=name=>({'E-mail':Mail,Sistemas:Settings,'Rede e Conectividade':Network,Impressoras:Printer,Hardware:Monitor}[name]||Layers);
const date=value=>value?new Date(value.replace(' ','T')+'Z').toLocaleDateString('pt-BR'):'Não definida';
function InfoItem({Icon,label,children,tone='',secondary=false}) {
  return <div className={'ticket-info-item '+tone+(secondary?' secondary-info':'')}><span className="ticket-info-icon"><Icon size={25}/></span><div><span className="ticket-info-label">{label}</span><div className="ticket-info-value">{children}</div></div></div>;
}
export default function TicketInformation({ticket:t,options,Badge,children,footer}) {
  const CategoryIcon=categoryIcon(t.category),priorityTone=t.priority==='Alta'?'priority-red':t.priority==='Média'?'priority-amber':t.priority==='Baixa'?'priority-green':'';
  return <section className="ticket-information" aria-label="Detalhes do chamado">
    <header className="ticket-information-heading"><h2>Detalhes do chamado</h2><span className="ticket-info-category"><CategoryIcon size={22}/><span>{t.category}{t.subcategory?` / ${t.subcategory}`:''}</span></span></header>
    <div className="ticket-information-grid">
      <InfoItem Icon={UserRound} label="Solicitante">{t.creator_name}</InfoItem>
      <InfoItem Icon={UsersRound} label="Responsável">{t.assignee_name||'Não atribuído'}</InfoItem>
      <InfoItem Icon={Flag} label="Prioridade" tone={priorityTone}><Badge value={t.priority} type="priority"/></InfoItem>
      <InfoItem Icon={CalendarDays} label="Início">{date(t.started_at)}</InfoItem>
      <InfoItem Icon={CalendarClock} label="Previsão de fim">{date(t.expected_end_at)}</InfoItem>
      <InfoItem Icon={CalendarCheck} label="Data final">{date(t.ended_at)}</InfoItem>
    </div>
    <div className="ticket-information-secondary">
      <InfoItem Icon={Monitor} label="Equipamento" secondary>{t.equipment||'Não informado'}</InfoItem>
      <InfoItem Icon={Settings} label="Trabalho / Complexidade" secondary>{Number(t.work_amount||0).toLocaleString('pt-BR')} {options.work_unit} · {t.scope_complexity||'Não definida'}</InfoItem>
      <InfoItem Icon={MapPin} label="Local" secondary>{t.location||'Não informado'}</InfoItem>
    </div>
    <section className="ticket-description-block"><header><span><FileText size={26}/></span><h3>Descrição</h3></header><div className="ticket-description-content">{children}</div></section>
    {footer}
  </section>;
}
