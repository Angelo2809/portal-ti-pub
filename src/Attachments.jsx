import React, { useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';

export async function encodeAttachments(files) {
  return Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error('Não foi possível ler ' + file.name));
    reader.onload = () => resolve({ name: file.name, content_type: file.type, data: String(reader.result).split(',')[1] });
    reader.readAsDataURL(file);
  })));
}
export function AttachmentPicker({ files, setFiles, disabled }) {
  const input = useRef(null), [dragging, setDragging] = useState(false), [error, setError] = useState('');
  const add = incoming => {
    if (disabled) return;
    const next = [...files];
    for (const file of incoming) if (!next.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) next.push(file);
    if (next.length > 5) { setError('Adicione no máximo 5 arquivos.'); return; }
    if (next.some(f => !f.size || f.size > 10 * 1024 * 1024)) { setError('Cada arquivo deve ter conteúdo e no máximo 10 MB.'); return; }
    if (next.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) { setError('Os anexos devem somar no máximo 25 MB.'); return; }
    setError(''); setFiles(next);
  };
  return <div className="attachment-field"><h4>Anexos</h4><input ref={input} type="file" multiple hidden disabled={disabled} onChange={e => { add(Array.from(e.target.files)); e.target.value = ''; }} />
    <button type="button" className={'attachment-drop ' + (dragging ? 'dragging' : '')} disabled={disabled} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); add(Array.from(e.dataTransfer.files)); }}><Upload size={24} /><strong>Arraste arquivos ou clique para adicionar</strong><span>Até 5 arquivos · 10 MB por arquivo · 25 MB no total</span></button>
    {files.map((file, i) => <div className="attachment-item" key={file.name + i}><Paperclip size={16} /><span>{file.name}<small>{(file.size / 1024).toFixed(1)} KB</small></span><button type="button" className="icon-plain" disabled={disabled} aria-label={'Remover ' + file.name} onClick={() => setFiles(f => f.filter((_, j) => i !== j))}><X size={16} /></button></div>)}
    {error && <div className="form-error" role="alert">{error}</div>}
  </div>;
}
export function TicketAttachments({ ticketId, files = [] }) {
  return files.length ? <div className="ticket-attachments"><h4>Anexos do chamado</h4>{files.map(file => <a className="attachment-item" key={file.id} href={`/api/tickets/${ticketId}/attachments/${file.id}`} download><Paperclip size={16} /><span>{file.name}<small>{(file.size / 1024).toFixed(1)} KB · Baixar arquivo</small></span></a>)}</div> : null;
}
