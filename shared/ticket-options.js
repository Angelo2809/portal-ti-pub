export const defaultTicketOptions = {
  categories: [
    { name: 'Suporte ao Usuário', subcategories: ['Acesso a sistemas', 'Estação de trabalho', 'Novo usuário'] },
    { name: 'Rede e Conectividade', subcategories: ['Internet', 'VPN', 'Wi-Fi', 'Impressão em rede'] },
    { name: 'Sistemas', subcategories: ['ERP', 'Sistemas internos', 'Solicitação de acesso'] },
    { name: 'Hardware', subcategories: ['Computadores', 'Impressoras', 'Periféricos'] },
    { name: 'E-mail', subcategories: ['Configuração', 'Falha no envio', 'Caixa de correio'] },
    { name: 'Impressoras', subcategories: ['Não imprime', 'Instalação', 'Manutenção'] },
    { name: 'Outros', subcategories: ['Dúvidas gerais', 'Solicitação diversa'] },
  ],
  urgencies: ['Baixa', 'Média', 'Alta', 'Crítica'],
  impacts: ['Baixo', 'Médio', 'Alto'],
  priorities: [
    { name: 'Baixa', start_minutes: 480, resolve_minutes: 2880 },
    { name: 'Média', start_minutes: 240, resolve_minutes: 1440 },
    { name: 'Alta', start_minutes: 60, resolve_minutes: 480 },
  ],
  sla_window: {start:'08:00',end:'18:00',days:[1,2,3,4,5],time_zone:'America/Sao_Paulo'},
  work_unit: 'horas',
  work_step: 0.25,
  complexities: ['Baixa', 'Média', 'Alta'],
  statuses: ['Aberto', 'Em atendimento', 'Aguardando cliente', 'Resolvido', 'Cancelado'],
};

export function normalizeTicketOptions(value={}) {
  return {...defaultTicketOptions,...value,sla_window:{...defaultTicketOptions.sla_window,...value.sla_window},priorities:value.priorities??defaultTicketOptions.priorities,complexities:value.complexities??defaultTicketOptions.complexities,work_unit:value.work_unit??defaultTicketOptions.work_unit,work_step:value.work_step??defaultTicketOptions.work_step};
}
export function ticketSla(ticket,options,now=Date.now()) {
  const parse=value=>value?Date.parse(value.replace(' ','T')+'Z'):null;
  const created=parse(ticket.created_at),started=parse(ticket.started_at),ended=parse(ticket.ended_at);
  const target=options.priorities.find(p=>p.name===ticket.priority);
  const stage=(end,minutes)=>{
    const elapsed=businessMinutes(created,end??now,options.sla_window);
    return {elapsed_minutes:elapsed,target_minutes:minutes??null,finished:end!=null,breached:minutes!=null&&elapsed>minutes};
  };
  return {start:stage(started??(ticket.status==='Cancelado'?ended:null),target?.start_minutes),resolution:stage(ended,target?.resolve_minutes)};
}

const formatters=new Map();
function localParts(ms,zone){
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  return Object.fromEntries(formatters.get(zone).formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function localBoundary(day,time,zone){
  const [hour,minute]=time.split(':').map(Number),desired=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),hour,minute);
  let guess=desired;
  for(let i=0;i<2;i++){const p=localParts(guess,zone);guess+=desired-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)}
  return guess;
}
export function businessMinutes(from,to,window=defaultTicketOptions.sla_window){
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return 0;
  const zone=window.time_zone,p=localParts(from,zone),q=localParts(to,zone);
  const day=new Date(Date.UTC(p.year,p.month-1,p.day)),last=Date.UTC(q.year,q.month-1,q.day);
  let total=0;
  for(;day.getTime()<=last;day.setUTCDate(day.getUTCDate()+1)){
    if(!window.days.includes(day.getUTCDay()))continue;
    const start=localBoundary(day,window.start,zone),end=localBoundary(day,window.end,zone);
    total+=Math.max(0,Math.min(to,end)-Math.max(from,start));
  }
  return Math.floor(total/60000);
}
