import { useEffect, useRef, useState } from 'react';
import { ApiError, type AccessApi, type PalletCreated, type PalletCreation, type PalletLabel, type ScanRecord } from './api';
import { LocationPicker } from './LocationPicker';
import type { CreationDraft } from './tabState';
import { modalKeys } from './modal';
import { useReaderFocus } from './useReaderFocus';

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
    if (running.current || reading.current || (!proposal && !!orders.length && !location)) return;
    const request = proposal ?? { request_id: crypto.randomUUID(), ...(location ? { location_id: location.id } : {}), productions: orders.map(order => ({ id: order.id, revision: order.revision! })) };
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
    <p>Puedes crear el pallet vacío o incluir OFs. Si incluyes OFs, elige una ubicación; se guardará todo junto.</p>
    <p className="reader-indicator" role="status" aria-label="Estado del lector de creación" data-ready={readerState === 'ready'}><span aria-hidden="true"/>{readerState === 'ready' ? 'Preparado para escanear OF o ubicación' : 'Selecciona el campo para escanear'}</p>
    <form onSubmit={event => { event.preventDefault(); void scan(); }}>
      <label htmlFor="create-scan">Escanear OF o ubicación</label>
      <input id="create-scan" ref={input} autoFocus autoComplete="off" maxLength={256} value={code} disabled={locked || scanning} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === 'Tab' && code.trim()) { event.preventDefault(); void scan(); } }}/>
      <button className="quiet-action" disabled={locked || scanning || !code.trim()}>Añadir lectura</button>
    </form>
    {scanning && <p role="status">Consultando lectura…</p>}
    <section aria-label="OFs del nuevo pallet"><h3>OFs incluidas · {orders.length}</h3>
      {!orders.length && <p>Se creará un pallet vacío. Puedes añadirle OFs después.</p>}
      <ul className="creation-orders">{orders.map(order => <li key={order.id}><div><strong>{order.code}</strong><span>{order.title}</span></div><button className="quiet-action" disabled={locked || scanning} aria-label={`Quitar OF ${order.code}`} onClick={() => { const next = orders.filter(r => r.id !== order.id); setOrders(next); draft(next); }}>Quitar</button></li>)}</ul>
    </section>
    <LocationPicker api={api} token={token} value={location} onChange={value => { setLocation(value); draft(orders, value); }} disabled={locked || scanning} onAccessError={onAccessError}/>
    {!location && <p>{orders.length ? "Elige o escanea una ubicación para las OFs." : "La ubicación es opcional. Si lo creas sin ubicación, se pedirá al escanearlo después."}</p>}
    {error && <p className="access-error" role="alert">{error}</p>}
    <button className="primary-action" disabled={busy || scanning || (!proposal && !!orders.length && !location)} onClick={() => void create()}>{busy ? 'Creando en Odoo…' : proposal ? 'Reintentar creación' : 'Crear pallet y ver etiqueta'}</button>
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
    <p className="print-help">Hoja A4 vertical con dos caras iguales. Dobla por la línea central: cada cara mostrará el código y el mismo QR en grande. Imprime al 100 %, sin encabezados ni pies. También puedes guardar como PDF.</p>
    {error ? <><p className="access-error" role="alert">{error}</p><button className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Reintentar etiqueta</button></> : !label ? <p role="status">Preparando QR…</p> : <>
      <PalletLabelSheet label={label} onReady={() => setReady(true)} onError={() => { setReady(false); setError('No se pudo cargar el QR. Reintenta la etiqueta.'); }}/>
      <div className="label-actions"><button className="primary-action" disabled={!ready} onClick={() => window.print()}>Imprimir etiqueta / Guardar PDF</button>
        <a className="quiet-action" href={'data:image/png;base64,' + label.png_base64} download={`${label.code}-QR.png`}>Descargar QR</a></div>
      <p className="print-help">Las dos caras identifican el mismo pallet. Añadir o quitar OFs y cambiar de ubicación no modifica su QR ni requiere reimprimir.</p>
    </>}
  </section></div>;
}

export function PalletLabelSheet({ label, onReady, onError }: { label: PalletLabel; onReady?(): void; onError?(): void }) {
  const loaded = useRef(new Set<number>());
  return <div className="label-sheet" aria-label="Hoja A4 para doblar por la mitad">
    {[0, 1].map(side => <article className={'pallet-label' + (side === 0 ? ' label-reversed' : '')} aria-label={`Cara ${side + 1} de ${label.code}`} key={side}>
      <strong className="label-code">{label.code}</strong>
      <img className="label-qr" src={'data:image/png;base64,' + label.png_base64} alt={`QR del pallet ${label.code}, cara ${side + 1}`} onLoad={() => { loaded.current.add(side); if (loaded.current.size === 2) onReady?.(); }} onError={onError}/>
    </article>)}
  </div>;
}
