import { useEffect, useRef, useState } from 'react';
import { ApiError, type AccessApi, type PalletCreated, type PalletCreation, type PalletLabel, type ScanRecord } from './api';
import { LocationPicker } from './LocationPicker';
import type { CreationDraft } from './tabState';
import { modalKeys } from './modal';
import { useReaderFocus } from './useReaderFocus';
import logo from '../dist/brand/cmp-logo-negativo.png';

type Common = { api: AccessApi; token: string; onClose(): void; onAccessError(error: ApiError): void };

export function CreatePalletDialog({ api, token, destination, selected, onClose, onCreated, onAccessError, initialDraft, onDraftChange }: Common & {
  selected: ScanRecord[]; destination: ScanRecord | null; onCreated(result: PalletCreated): void; initialDraft?: CreationDraft; onDraftChange?(draft: CreationDraft): void;
}) {
  const [location, setLocation] = useState(initialDraft ? initialDraft.location : destination && destination.active !== false ? { id: destination.id, code: destination.code, name: destination.title } : null);
  const [orders, setOrders] = useState(initialDraft?.productions ?? selected);
  const [proposal, setProposal] = useState<PalletCreation | null>(initialDraft?.proposal ?? null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const codeRef = useRef(code); codeRef.current = code;
  const [collector] = useState(() => ({ get value() { return codeRef.current; }, setValue: setCode, clear: () => setCode('') }));
  const running = useRef(false);
  const reading = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const locked = busy || !!proposal;
  const { focus, readerState } = useReaderFocus(input, !locked && !scanning, collector);
  const close = () => { if (!locked && !scanning) onClose(); };
  function draft(nextOrders = orders, nextLocation = location, nextProposal = proposal) {
    onDraftChange?.({ productions: nextOrders, location: nextLocation, proposal: nextProposal });
  }
  async function scan() {
    if (locked || reading.current || !code.trim()) return;
    const value = code.trim(); setCode(''); setError(''); setScanning(true); reading.current = true;
    try {
      const result = await api.lookup(token, value);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      const r = result.record;
      if (r.kind === 'location' && r.active !== false) {
        const next = { id: r.id, code: r.code, name: r.title };
        setLocation(next); draft(orders, next);
      } else if (r.kind === 'production' && r.revision) {
        if (orders.some(order => order.id === r.id)) { setError('Esta OF ya está incluida.'); return; }
        if (orders.length >= 100) { setError('Puedes incluir hasta 100 OFs.'); return; }
        const next = [...orders, r]; setOrders(next); draft(next);
      } else setError('Escanea una OF o una ubicación activa. No se ha añadido esta lectura.');
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof ApiError && ['session', 'access'].includes(reason.kind)) onAccessError(reason);
      else setError(reason instanceof Error ? reason.message : 'No se pudo consultar el código.');
    } finally { reading.current = false; if (mounted.current) { setScanning(false); setTimeout(focus, 0); } }
  }

  async function create() {
    if (running.current || reading.current || (!proposal && (!orders.length || !location))) return;
    const request = proposal ?? { request_id: crypto.randomUUID(), location_id: location!.id, productions: orders.map(order => ({ id: order.id, revision: order.revision! })) };
    draft(orders, location, request);
    running.current = true; setProposal(request); setBusy(true); setError('');
    try {
      const result = await api.createPallet(token, request);
      if (mounted.current) onCreated(result);
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof ApiError && reason.kind !== 'network') {
        setProposal(null); draft(orders, location, null);
        if (reason.kind === 'business') setError(reason.message);
        else onAccessError(reason);
      } else setError('No se ha confirmado la creación. Reintenta la misma petición para evitar duplicados.');
    } finally { running.current = false; setBusy(false); }
  }

  return <div className="modal-backdrop"><section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="create-pallet-title" onKeyDown={event => modalKeys(event, close)}>
    <div className="modal-heading"><h2 id="create-pallet-title">Crear pallet</h2><button className="icon-action" aria-label="Cerrar creación" disabled={locked || scanning} onClick={close}>×</button></div>
    <p>Escanea al menos una OF y elige ubicación. Se guardarán juntas y después podrás imprimir la etiqueta completa.</p>
    <p className="reader-indicator" role="status" aria-label="Estado del lector de creación" data-ready={readerState === 'ready'}><span aria-hidden="true"/>{readerState === 'ready' ? 'Preparado para escanear OF o ubicación' : 'Selecciona el campo para escanear'}</p>
    <form onSubmit={event => { event.preventDefault(); void scan(); }}>
      <label htmlFor="create-scan">Escanear OF o ubicación</label>
      <input id="create-scan" ref={input} autoFocus autoComplete="off" maxLength={256} value={code} disabled={locked || scanning} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === 'Tab' && code.trim()) { event.preventDefault(); void scan(); } }}/>
      <button className="quiet-action" disabled={locked || scanning || !code.trim()}>Añadir lectura</button>
    </form>
    {scanning && <p role="status">Consultando lectura…</p>}
    <section aria-label="OFs del nuevo pallet"><h3>OFs incluidas · {orders.length}</h3>
      {!orders.length && <p>Añade al menos una OF para poder crear el pallet.</p>}
      <ul className="creation-orders">{orders.map(order => <li key={order.id}><div><strong>{order.code}</strong><span>{order.title}</span></div><button className="quiet-action" disabled={locked || scanning} aria-label={`Quitar OF ${order.code}`} onClick={() => { const next = orders.filter(r => r.id !== order.id); setOrders(next); draft(next); }}>Quitar</button></li>)}</ul>
    </section>
    <LocationPicker api={api} token={token} value={location} onChange={value => { setLocation(value); draft(orders, value); }} disabled={locked || scanning} onAccessError={onAccessError}/>
    {!location && <p>Elige o escanea una ubicación para poder crear el pallet.</p>}
    <p>Odoo comprobará que las OFs pertenecen al mismo cliente. Los datos que falten en Odoo aparecerán como «Sin dato» en la etiqueta.</p>
    {error && <p className="access-error" role="alert">{error}</p>}
    <button className="primary-action" disabled={busy || scanning || (!proposal && (!orders.length || !location))} onClick={() => void create()}>{busy ? 'Creando en Odoo…' : proposal ? 'Reintentar creación' : 'Crear pallet y ver etiqueta'}</button>
    {!locked && <button className="quiet-action" onClick={close}>Cancelar</button>}
  </section></div>;
}

export function PalletLabelDialog({ api, token, pallet, onClose, onAccessError }: Common & { pallet: { id: number; code: string } }) {
  const [label, setLabel] = useState<PalletLabel | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLabel(null); setReady(false); setError('');
    api.label(token, pallet.id).then(result => { if (!cancelled) setLabel(result); }).catch(reason => {
      if (cancelled) return;
      if (reason instanceof ApiError && ['session', 'access'].includes(reason.kind)) onAccessError(reason);
      else setError(reason instanceof Error ? reason.message : 'No se pudo obtener la etiqueta.');
    });
    return () => { cancelled = true; };
  }, [api, token, pallet.id, attempt]);

  return <div className="modal-backdrop label-backdrop"><section className="scan-modal label-modal" role="dialog" aria-modal="true" aria-labelledby="pallet-label-title" onKeyDown={event => modalKeys(event, onClose)}>
    <div className="modal-heading"><h2 id="pallet-label-title">Etiqueta · {pallet.code}</h2><button className="icon-action" aria-label="Cerrar etiqueta" autoFocus onClick={onClose}>×</button></div>
    <p className="print-help">Una etiqueta por pallet, con un único QR. Tamaño base 100 × 60 mm en hoja A4; la altura aumenta según el contenido. Imprime al 100 %, sin encabezados ni pies. También puedes guardar como PDF.</p>
    {error ? <><p className="access-error" role="alert">{error}</p><button className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Reintentar etiqueta</button></> : !label ? <p role="status">Preparando QR…</p> : <>
      <PalletLabelSheet label={label} onReady={() => setReady(true)} onError={() => { setReady(false); setError('No se pudo cargar el QR. Reintenta la etiqueta.'); }}/>
      <div className="label-actions"><button className="primary-action" disabled={!ready} onClick={() => window.print()}>Imprimir etiqueta / Guardar PDF</button>
        <a className="quiet-action" href={'data:image/png;base64,' + label.png_base64} download={`${label.code}-QR.png`}>Descargar QR</a></div>
      <p className="print-help">Reimprimir conserva el mismo código y no crea otro pallet. La etiqueta reúne todas las OFs y muestra un único QR del pallet. Si cambia el contenido, reimprime y sustituye las etiquetas anteriores.</p>
    </>}
  </section></div>;
}

export function PalletLabelSheet({ label, onReady, onError }: { label: PalletLabel; onReady?(): void; onError?(): void }) {
  const rows = label.contents ?? [];
  const values = (key: 'customer' | 'project' | 'product' | 'description' | 'reference') => [...new Set(rows.map(row => row[key] || 'Sin dato'))];
  const projects = values('project');
  const references = values('reference');
  const products = [...new Set(rows.map(row => JSON.stringify([row.product, row.description])))];
  const manyProducts = products.length > 1;
  const first = rows[0];
  return <div className="label-sheet"><article className="pallet-label" aria-label={`Etiqueta de ${label.code}`}>
    <header className="label-heading"><img src={logo} alt="CMP"/><strong>{label.code}</strong></header>
    <img className="label-qr" src={'data:image/png;base64,' + label.png_base64} alt={`QR del pallet ${label.code}`} onLoad={onReady} onError={onError}/>
    <div className="label-business"><small>CLIENTE</small><b>{values('customer').join(' · ') || 'Sin dato'}</b>
      <small>PROYECTO</small><b>{projects.length > 1 ? 'Varios (ver OFs)' : projects[0] || 'Sin dato'}</b>
      <small>PRODUCTO PRINCIPAL</small><strong>{manyProducts ? 'Varios (ver OFs)' : first?.product || 'Sin dato'}</strong>
      {!manyProducts && <span>{first?.description || ''}</span>}
    </div>
    <div className="label-reference">
      {rows.length ? rows.map(row => <div className="label-order" key={row.of_code}>
        <div><b>{row.of_code}</b> · Producto OF: {row.of_product || 'Sin dato'}</div>
        {manyProducts && <div>Principal: <b>{row.product || 'Sin dato'}</b> · {row.description}</div>}
        {projects.length > 1 && <div>Proyecto: <b>{row.project || 'Sin dato'}</b></div>}
        {references.length > 1 && <div>Ref. cliente: <b>{row.reference || 'Sin dato'}</b></div>}
      </div>) : <b>Pallet sin OFs</b>}
      {references.length <= 1 && <div>Ref. cliente: <b>{references[0] || 'Sin dato'}</b></div>}
    </div>
    <footer>Contenido al {label.printed_on?.split('-').reverse().join('/') || new Date().toLocaleDateString('es-ES')} · {rows.length} OFs</footer>
  </article></div>;
}
