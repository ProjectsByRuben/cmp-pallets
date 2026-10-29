import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createHidCollector } from '../dist/hid.mjs';
import { ApiError, type Association, type AccessApi, type Profile, type ScanRecord, type ScanSummary } from './api';
import { Camera } from './Camera';
import { modalKeys } from './modal';
import { useReaderFocus } from './useReaderFocus';

const prefixes = { production: 'OF', pallet: 'PALLET', location: 'LOC' };
const labels = { production: 'Orden de fabricación', pallet: 'Pallet', location: 'Ubicación' };
const codeFor = (item: ScanSummary) => `CMP:${prefixes[item.kind]}:${item.code}`;

export function ScanWorkspace({ api, token, profile, onAccessError, onSwitch, onChangeAccount, switching }: {
  api: AccessApi; token: string; profile: Profile; onAccessError(error: ApiError): void;
  onSwitch(): void; onChangeAccount(): void; switching: boolean;
}) {
  const [selected, setSelected] = useState<ScanRecord[]>([]);
  const [target, setTarget] = useState<ScanRecord | null>(null);
  const [destination, setDestination] = useState<ScanRecord | null>(null);
  const [pending, setPending] = useState<Association | null>(null);
  const [notice, setNotice] = useState('');
  const [partial, setPartial] = useState('');
  const [record, setRecord] = useState<ScanRecord | null>(null);
  const [previous, setPrevious] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const version = useRef(0);
  const lastRead = useRef({ code: '', at: 0 });
  const latest = useRef({ read: (_code: string) => {} });
  const [collector] = useState(() => createHidCollector({
    onRead: code => latest.current.read(code),
    onPartial: setPartial,
    isKnown: code => !inFlight.current && (/^OF\d{2}-\d+$/i.test(code) || /^P\d{9,}$/.test(code) || /^CMP:(OF|PALLET|LOC):[^\r\n]+$/.test(code)),
  }));

  const { focus, readerState } = useReaderFocus(input, !busy && !pending && !camera && !manual, collector);

  async function read(code: string, mode: 'new' | 'back' | 'refresh' | 'more' = 'new') {
    if (inFlight.current || pending) return;
    code = code.trim();
    if (!code) return;
    if (mode === 'new' && lastRead.current.code === code && Date.now() - lastRead.current.at < 1000) return;
    lastRead.current = { code, at: Date.now() };
    const current = ++version.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    collector.clear();
    try {
      const result = await api.lookup(token, code, mode === 'more' ? record?.next_offset ?? 0 : 0);
      if (version.current !== current) return;
      if (!result.ok) { setError(result.error); return; }
      setNotice('');
      if (mode === 'new') {
        const item = result.record;
        if (item.kind === 'production') {
          if (selected.length >= 100 && !selected.some(p => p.id === item.id)) { setError('Puedes asociar hasta 100 OFs a la vez.'); return; }
          setSelected(items => items.some(p => p.id === item.id) ? items.map(p => p.id === item.id ? item : p) : items.length < 100 ? [...items, item] : items);
          setTarget(null); setDestination(null);
        } else if (item.kind === 'pallet' && selected.length) {
          if (item.active === false) { setError('El pallet está archivado. Lee otro destino.'); return; }
          setTarget(item); setDestination(null);
        } else if (item.kind === 'location' && target && !target.location) {
          if (item.active === false) { setError('La ubicación está archivada.'); return; }
          setDestination(item);
        }
      }
      if (mode === 'more' && record && result.record.kind === record.kind && result.record.id === record.id) {
        const known = new Set(record.items.map(item => `${item.kind}:${item.id}`));
        setRecord({ ...result.record, items: [...record.items, ...result.record.items.filter(item => !known.has(`${item.kind}:${item.id}`))] });
      } else {
        if (mode === 'new' && record) setPrevious(items => [...items.slice(-19), codeFor(record)]);
        if (mode === 'back') setPrevious(items => items.slice(0, -1));
        setRecord(result.record);
      }
    } catch (reason) {
      if (version.current !== current) return;
      setRecord(null);
      if (reason instanceof ApiError && reason.kind !== 'network') onAccessError(reason);
      else setError(reason instanceof Error ? reason.message : 'No se pudo consultar el código. Vuelve a intentarlo.');
    } finally {
      inFlight.current = false;
      if (version.current === current) { setBusy(false); setTimeout(focus, 0); }
    }
  }

  latest.current.read = code => { void read(code); };
  useEffect(() => {
    focus();
    return () => { version.current++; collector.clear(); };
  }, []);
  useEffect(() => {
    if (!camera && !manual && !busy) focus();
  }, [camera, manual, busy]);

  function home() {
    collector.clear();
    lastRead.current = { code: '', at: 0 };
    setRecord(null);
    setSelected([]); setTarget(null); setDestination(null); setPending(null);
    setPrevious([]);
    setError('');
    focus();
  }

  async function confirm() {
    if (inFlight.current || !target || !selected.length) return;
    if (!pending && (!target.revision || selected.some(p => !p.revision))) {
      setError('Actualiza las lecturas antes de confirmar.'); return;
    }
    const proposal = pending ?? {
      request_id: crypto.randomUUID(), pallet_id: target.id, pallet_revision: target.revision!,
      productions: selected.map(p => ({ id: p.id, revision: p.revision! })),
      ...(!target.location && destination ? { location_id: destination.id } : {}),
    };
    setPending(proposal);
    inFlight.current = true; setBusy(true); setError('');
    const current = ++version.current;
    try {
      const result = await api.associate(token, proposal);
      if (current !== version.current) return;
      setPending(null);
      if (!result.ok) {
        setError(result.error);
        if (result.conflict) { setTarget(null); setDestination(null); setSelected([]); }
        return;
      }
      home();
      setNotice(`Asociación confirmada en ${result.pallet_code}: ${result.added} OFs añadidas.`);
    } catch (reason) {
      if (current !== version.current) return;
      if (reason instanceof ApiError && reason.kind !== 'network') {
        setPending(null);
        if (reason.kind === 'business') setError(reason.message);
        else onAccessError(reason);
      } else {
        setError('No se ha recibido confirmación de Odoo. Reintenta para comprobar y completar la misma petición.');
      }
    } finally {
      inFlight.current = false;
      if (current === version.current) { setBusy(false); setTimeout(focus, 0); }
    }
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    setManual(false);
    setManualCode('');
    void read(manualCode);
  }

  function closeManual() { setManual(false); setManualCode(''); }

  return <main className="scan-workspace">
    <div className="operator-bar"><div><strong>{profile.name}</strong><span>{profile.role === 'admin' ? 'Administrador' : 'Operario'}</span></div><button className="quiet-action" disabled={busy || switching || !!pending} onClick={onSwitch}>Cambiar operario</button></div>
    <nav className="scan-navigation" aria-label="Navegación de consultas">
      <button className="quiet-action" disabled={busy || !!pending || !previous.length} onClick={() => void read(previous.at(-1)!, 'back')}>← Volver</button>
      <button className="quiet-action" disabled={busy || !!pending} onClick={home}>⌂ Inicio</button>
    </nav>
    <h1>Escanear</h1>
    <section className="live-reader" aria-label="Lector QR">
      <p className="reader-indicator" role="status" aria-label="Estado del lector" data-ready={readerState === 'ready'}><span aria-hidden="true"/>{readerState === 'inactive' ? 'Activa esta página para leer' : busy ? 'Consultando Odoo…' : readerState === 'paused' ? 'Lector en pausa' : readerState === 'unfocused' ? 'Selecciona la casilla para leer' : 'Preparado para leer'}</p>
      <form onSubmit={event => { event.preventDefault(); void read(partial); }}>
        <label className="sr-only" htmlFor="live-code">Código de OF, pallet o ubicación</label>
        <div className="live-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7h3v3H7zm7 0h3v3h-3zm-7 7h3v3H7zm7 0h3v3h-3z"/></svg>
          <input ref={input} id="live-code" inputMode="none" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="OF, pallet o ubicación" value={partial} disabled={busy || !!pending} onChange={event => collector.setValue(event.target.value)} onKeyDown={event => collector.key(event.nativeEvent)}/>
          <button className="icon-action" aria-label="Consultar código" disabled={busy || !partial}>→</button>
        </div>
      </form>
      <div className="reader-actions"><button className="quiet-action" disabled={busy || !!pending} onClick={() => { collector.clear(); setCamera(true); }}>▣ Cámara</button><button className="quiet-action" disabled={busy || !!pending} onClick={() => { collector.clear(); setManual(true); }}>⌨ Escribir</button></div>
    </section>
    {notice && <p className="association-success" role="status">{notice}</p>}
    {!!selected.length && <section className="record-card" aria-label="Asociación pendiente">
      <h2>OFs seleccionadas · {selected.length}</h2>
      <ul className="association-selection">{selected.map(item => <li key={item.id}><span>{item.code}</span><button className="quiet-action" disabled={busy || !!pending} aria-label={`Quitar ${item.code}`} onClick={() => { setSelected(items => items.filter(p => p.id !== item.id)); setTarget(null); setDestination(null); }}>Quitar</button></li>)}</ul>
      {target ? <>
        <p>Destino: <strong>{target.code}</strong></p>
        <p>Ubicación: <strong>{target.location ? `${target.location.code} · ${target.location.name}` : destination ? `${destination.code} · ${destination.title}` : 'Escanea una ubicación para continuar'}</strong></p>
        <p>Se conservarán las asociaciones con otros pallets.</p>
        <button className="primary-action" disabled={busy || (!target.location && !destination)} onClick={() => void confirm()}>{busy ? 'Guardando en Odoo…' : pending ? 'Reintentar confirmación' : 'Confirmar asociación'}</button>
        {!pending && <button className="quiet-action" disabled={busy} onClick={() => { setTarget(null); setDestination(null); }}>Cambiar pallet</button>}
      </> : <p>Escanea más OFs o el pallet de destino.</p>}
      {!pending && <button className="quiet-action" disabled={busy} onClick={home}>Cancelar selección</button>}
    </section>}
    {error && <p className="access-error" role="alert">{error}</p>}
    {!record && !error && <div className="scan-empty"><p>Escanea una OF, un pallet o una ubicación.</p></div>}
    {record && <section className="record-card" aria-label="Detalle de la lectura">
      <div className="record-heading"><div><p className="eyebrow">{labels[record.kind]}</p><h2>{record.code}</h2></div><button className="icon-action" disabled={busy || !!pending} onClick={() => void read(codeFor(record), 'refresh')} aria-label="Actualizar consulta">↻</button></div>
      <p className="record-title">{record.title}</p>
      {record.state_label && <span className="role-badge">{record.state_label}</span>}
      {record.active === false && <p className="archived-badge">Archivado</p>}
      {record.kind === 'production' && <dl className="record-facts"><div><dt>Cantidad de la OF</dt><dd>{new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(record.quantity ?? 0)} {record.uom}</dd></div>{record.lot && <div><dt>Lote / serie</dt><dd>{record.lot}</dd></div>}</dl>}
      {record.kind === 'pallet' && <dl className="record-facts"><div><dt>Ubicación</dt><dd>{record.location ? `${record.location.code} · ${record.location.name}` : 'Sin ubicación disponible'}</dd></div></dl>}
      <h3>{record.kind === 'pallet' ? 'Órdenes de fabricación' : 'Pallets'}</h3>
      {!record.items.length && <p className="empty-relation">{record.kind === 'pallet' ? 'Sin OF disponibles' : 'Sin pallets disponibles'}</p>}
      <ul className="record-list">{record.items.map(item => <li key={`${item.kind}:${item.id}`}><button disabled={busy || !!pending} onClick={() => void read(codeFor(item))}><span><strong>{item.code}</strong><small>{item.kind === 'pallet' ? item.location ? `${item.location.code} · ${item.location.name}` : 'Sin ubicación disponible' : item.title}</small></span><span className="list-status">{item.active === false ? 'Archivado' : item.state_label || 'Ver'} →</span></button></li>)}</ul>
      {record.next_offset !== null && <button className="secondary-action" disabled={busy || !!pending} onClick={() => void read(codeFor(record), 'more')}>Ver más</button>}
    </section>}
    <footer className="scan-footer"><button className="quiet-action" disabled={busy || switching || !!pending} onClick={onChangeAccount}>Cambiar cuenta</button></footer>
    {manual && <div className="modal-backdrop"><section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="manual-title" onKeyDown={event => modalKeys(event, closeManual)}><div className="modal-heading"><h2 id="manual-title">Introducir código</h2><button className="icon-action" aria-label="Cerrar entrada manual" onClick={closeManual}>×</button></div><form onSubmit={submitManual}><label htmlFor="manual-code">OF, pallet o ubicación</label><input id="manual-code" autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} value={manualCode} onChange={event => setManualCode(event.target.value)} required maxLength={256}/><button className="primary-action" disabled={!manualCode.trim()}>Consultar</button></form></section></div>}
    {camera && <Camera onClose={() => setCamera(false)} onRead={code => { setCamera(false); void read(code); }}/>}
  </main>;
}
