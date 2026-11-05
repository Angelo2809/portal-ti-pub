import React, {useEffect, useRef, useState} from 'react';
import {Bell, MessageCircle, Activity, X} from 'lucide-react';
import './notifications.css';

export default function Notifications({data, onOpen}) {
  const [open,setOpen]=useState(false),[all,setAll]=useState(false),[busy,setBusy]=useState(null);
  const root=useRef(null);
  useEffect(()=>{if(!open)return;const close=e=>{if(!root.current?.contains(e.target))setOpen(false)},escape=e=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}},[open]);
  const rows=data.notifications.filter(n=>all||!n.is_read);
  const label=n=>n.kind==='comment'?'Nova mensagem':n.kind==='created'?'Chamado aberto':n.kind==='edited'?'Chamado editado':n.new_status?`Atualização · ${n.new_status}`:'Atendimento atualizado';
  return <div className="notification-root" ref={root}>
    <button className="notification-bell" aria-label={`Notificações, ${data.unread_count} não lidas`} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Bell size={21}/>{data.unread_count>0&&<span>{data.unread_count>99?'99+':data.unread_count}</span>}</button>
    {open&&<section className="notification-popover" aria-label="Notificações dos chamados"><div className="notification-heading"><strong>Notificações <small>{data.unread_count} não lidas</small></strong><button className="icon-plain" aria-label="Fechar notificações" onClick={()=>setOpen(false)}><X size={18}/></button></div><div className="notification-tabs"><button className={!all?'active':''} onClick={()=>setAll(false)}>Não lidas</button><button className={all?'active':''} onClick={()=>setAll(true)}>Todas</button></div><div className="notification-items">
      {rows.map(n=><button key={n.id} className={'notification-item '+(!n.is_read?'unread':'')} disabled={busy!==null} onClick={async()=>{setBusy(n.id);try{if(await onOpen(n.ticket_id))setOpen(false)}finally{setBusy(null)}}}>{n.kind==='comment'?<MessageCircle size={18}/>:<Activity size={18}/>}<span><strong>#{String(n.ticket_id).padStart(5,'0')} · {label(n)}</strong><b>{n.subject}</b><span>{n.actor_name}{n.preview?' · '+n.preview:''}</span><small>{new Date(n.created_at.replace(' ','T')+'Z').toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}{n.is_read?' · Lida':''}</small></span>{!n.is_read&&<i/>}</button>)}
      {!rows.length&&<p className="notification-empty">{all?'Nenhuma atualização recente.':'Você está em dia com os chamados.'}</p>}
    </div><p className="notification-footer">Últimas 60 atualizações. Abra o chamado para ler.</p></section>}
  </div>;
}
