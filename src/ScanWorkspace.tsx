import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createHidCollector } from '../dist/hid.mjs';
import { ApiError, type Association, type Movement, type AccessApi, type Profile, type ScanRecord, type ScanSummary } from './api';
import { CreatePalletDialog, PalletLabelDialog } from './PalletDialogs';
import { Camera } from './Camera';
import { modalKeys } from './modal';
import { useReaderFocus } from './useReaderFocus';

type Pending = { kind: 'associate'; data: Association } | { kind: 'move'; data: Movement };

const prefixes = { production: 'OF', pallet: 'PALLET', location: 'LOC' };
const labels = { production: 'Orden de fabricación', pallet: 'Pallet', location: 'Ubicación' };
const codeFor = (item: ScanSummary) => `CMP:${prefixes[item.kind]}:${item.code}`;

export function ScanWorkspace({ api, token, profile, onAccessError, onSwitch, onChangeAccount, switching }: {
  api: AccessApi; token: string; profile: Profile; onAccessError(error: ApiError): void;
  onSwitch(): void; onChangeAccount(): void; switching: boolean;
}) {
  const [selected, setSelected] = useState<ScanRecord[]>([]);
  const [pallets, setPallets] = useState<ScanRecord[]>([]);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [destination, setDestination] = useState<ScanRecord | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const target = pallets.find(p => p.id === targetId) ?? (pallets.length === 1 ? pallets[0] : null);
  const moving = destination ? pallets.filter(p => p.location?.id !== destination.id) : [];
  const hasSelection = !!(selected.length || pallets.length || destination);
  const [notice, setNotice] = useState('');
  const [partial, setPartial] = useState('');
  const [record, setRecord] = useState<ScanRecord | null>(null);
  const [previous, setPrevious] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState(false);
  const [creating, setCreating] = useState(false);
  const [labelPallet, setLabelPallet] = useState<{ id: number; code: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const version = useRef(0);
  const lastRead = useRef({ code: '', at: 0 });
  const latest = useRef({ read: (_code: string) => {} });
  const [collector] = useState(() => createHidCollector({
    onRead: code => latest.current.read(code),
    onPartial: setPartial,
    isKnown: code => !inFlight.current && (/^OF\d{2}-\d+$/i.test(code) || /^P(?:\d{2}-\d{5,}|\d{9,})$/.test(code) || /^CMP:(OF|PALLET|LOC):[^\r\n]+$/.test(code)),
  }));

  const { focus, readerState } = useReaderFocus(input, !busy && !pending && !camera && !manual && !creating && !labelPallet, collector);

  async function read(code: string, mode: 'new' | 'back' | 'refresh' | 'more' | 'inspect' = 'new') {
    if (inFlight.current || pending) return;
    code = code.trim();
    if (!code) return;
    if (mode === 'new' && lastRead.current.code === code && Date.now() - lastRead.current.at < 1000) return;
    lastRead.current = { code, at: Date.now() };
    const current = ++version.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    collector.clear();
    try {
      const result = await api.lookup(token, code, mode === 'more' ? record?.next_offset ?? 0 : 0);
      if (version.current !== current) return;
      if (!result.ok) { setError(result.error); return; }
      setNotice('');
      const item = result.record;
      if (mode === 'new' || mode === 'refresh' || mode === 'inspect') {
        if (item.kind === 'production') {
          if (mode === 'new' && selected.length >= 100 && !selected.some(p => p.id === item.id)) { setError('Puedes seleccionar hasta 100 OFs a la vez.'); return; }
          setSelected(items => items.some(p => p.id === item.id) ? items.map(p => p.id === item.id ? item : p) : mode === 'new' ? [...items, item] : items);
        } else if (item.kind === 'pallet') {
          if (mode === 'new' && pallets.length >= 100 && !pallets.some(p => p.id === item.id)) { setError('Puedes seleccionar hasta 100 pallets a la vez.'); return; }
          setPallets(items => items.some(p => p.id === item.id) ? items.map(p => p.id === item.id ? item : p) : mode === 'new' && item.active !== false ? [...items, item] : items);
          if (item.active === false) setError('El pallet está archivado. Quítalo de la selección y lee otro destino.');
        } else if (mode === 'new' || destination?.id === item.id) {
          if (item.active === false) { setError('La ubicación está archivada. Lee otra ubicación.'); if (destination?.id === item.id) setDestination(null); }
          else setDestination(item);
        }
      }
      if (mode === 'more' && record && result.record.kind === record.kind && result.record.id === record.id) {
        const known = new Set(record.items.map(item => `${item.kind}:${item.id}`));
        setRecord({ ...result.record, items: [...record.items, ...result.record.items.filter(item => !known.has(`${item.kind}:${item.id}`))] });
      } else {
        if ((mode === 'new' || mode === 'inspect') && record) setPrevious(items => [...items.slice(-19), codeFor(record)]);
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
    if (!camera && !manual && !creating && !labelPallet && !busy) focus();
  }, [camera, manual, creating, labelPallet, busy]);

  function home() {
    collector.clear();
    lastRead.current = { code: '', at: 0 };
    setRecord(null);
    setSelected([]); setPallets([]); setTargetId(null); setDestination(null); setPending(null);
    setNotice('');
    setPrevious([]);
    setError('');
    focus();
  }

  function removeOrder(id: number) {
    setSelected(items => items.filter(p => p.id !== id));
    lastRead.current = { code: '', at: 0 };
  }

  function removePallet(id: number) {
    setPallets(items => items.filter(p => p.id !== id));
    if (targetId === id) setTargetId(null);
    lastRead.current = { code: '', at: 0 };
  }

  function removeLocation() {
    setDestination(null);
    lastRead.current = { code: '', at: 0 };
  }

  async function confirm(kind: Pending['kind']) {
    if (inFlight.current || (pending && pending.kind !== kind)) return;
    let proposal = pending;
    if (!proposal) {
      if (kind === 'associate') {
        if (!target || !selected.length || (!target.location && !destination)) return;
        if (!target.revision || selected.some(p => !p.revision)) { setError('Actualiza las lecturas antes de confirmar.'); return; }
        proposal = { kind, data: {
          request_id: crypto.randomUUID(), pallet_id: target.id, pallet_revision: target.revision,
          productions: selected.map(p => ({ id: p.id, revision: p.revision! })),
          ...(!target.location && destination ? { location_id: destination.id } : {}),
        } };
      } else {
        if (!destination || !pallets.length || !moving.length) return;
        if (pallets.some(p => !p.revision)) { setError('Actualiza las lecturas antes de confirmar.'); return; }
        proposal = { kind, data: {
          request_id: crypto.randomUUID(), location_id: destination.id,
          pallets: pallets.map(p => ({ id: p.id, revision: p.revision! })),
        } };
      }
    }
    setPending(proposal);
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    const current = ++version.current;
    try {
      const result = proposal.kind === 'associate'
        ? await api.associate(token, proposal.data) : await api.move(token, proposal.data);
      if (current !== version.current) return;
      setPending(null);
      if (!result.ok) {
        setError(result.error);
        if (result.conflict) { setTargetId(null); setDestination(null); setSelected([]); setPallets([]); }
        return;
      }
      home();
      setNotice('pallet_code' in result
        ? `Asociación confirmada en ${result.pallet_code}: ${result.added} OFs añadidas.`
        : `Traslado confirmado a ${result.location_code}: ${result.moved} pallets movidos; ${result.unchanged} ya estaban allí.`);
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

  return <><main className="scan-workspace" inert={creating || !!labelPallet}>
    <div className="operator-bar"><div><strong>{profile.name}</strong><span>{profile.role === 'admin' ? 'Administrador' : 'Operario'}</span></div><button className="quiet-action" disabled={busy || switching || !!pending} onClick={onSwitch}>Cambiar operario</button></div>
    <nav className="scan-navigation" aria-label="Navegación de consultas">
      <button className="quiet-action" disabled={busy || !!pending || !previous.length} onClick={() => void read(previous.at(-1)!, 'back')}>← Volver</button>
      <button className="quiet-action" disabled={busy || !!pending} onClick={home}>⌂ Inicio</button>
    </nav>
    <div className="workspace-heading"><h1>Escanear</h1><button className="secondary-action" disabled={busy || !!pending || pallets.length >= 100} onClick={() => { collector.clear(); setCreating(true); }}>＋ Crear pallet</button></div>
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
    {!!pallets.length && <section className="record-card" aria-label="Pallets seleccionados">
      <h2>Pallets seleccionados · {pallets.length}</h2>
      <ul className="association-selection">{pallets.map(item => <li key={item.id}>
        <span><strong>{item.code}</strong><small>{item.active === false ? 'Archivado' : item.location ? `${item.location.code} · ${item.location.name}` : 'Sin ubicación'}</small></span>
        <button className="quiet-action" disabled={busy || !!pending} aria-label={`Quitar ${item.code}`} onClick={() => removePallet(item.id)}>Quitar</button>
      </li>)}</ul>
      {!destination && <p>Escanea una ubicación para mover estos pallets, o una OF para asociarla.</p>}
    </section>}
    {destination && <section className="record-card" aria-label="Ubicación seleccionada">
      <div className="record-heading"><div><p className="eyebrow">Ubicación seleccionada</p><strong>{destination.code} · {destination.title}</strong></div>
        <button className="quiet-action" disabled={busy || !!pending} aria-label="Quitar ubicación" onClick={removeLocation}>Quitar</button></div>
      {!pallets.length && <p>Escanea uno o varios pallets para preparar el traslado.</p>}
    </section>}
    {!!selected.length && <section className="record-card" aria-label="Asociación pendiente">
      <h2>OFs seleccionadas · {selected.length}</h2>
      <ul className="association-selection">{selected.map(item => <li key={item.id}><span>{item.code}</span><button className="quiet-action" disabled={busy || !!pending} aria-label={`Quitar ${item.code}`} onClick={() => removeOrder(item.id)}>Quitar</button></li>)}</ul>
      {pallets.length > 1 && <div className="association-target"><label htmlFor="target-pallet">Pallet de destino para las OFs</label>
        <select id="target-pallet" disabled={busy || !!pending} value={targetId ?? ''} onChange={event => { setTargetId(event.target.value ? Number(event.target.value) : null); setTimeout(focus, 0); }}>
          <option value="">Elige un único pallet</option>{pallets.map(p => <option key={p.id} value={p.id} disabled={p.active === false}>{p.code}</option>)}
        </select></div>}
      {target ? <>
        <p>Destino de las OFs: <strong>{target.code}</strong></p>
        <p>Ubicación del pallet: <strong>{target.location ? `${target.location.code} · ${target.location.name}` : destination ? `${destination.code} · ${destination.title}` : 'Escanea una ubicación para continuar'}</strong></p>
        <p>Se conservarán las asociaciones con otros pallets.</p>
        {target.location && destination && target.location.id !== destination.id && <p>Esta asociación conserva la ubicación actual del pallet. Para cambiarla, confirma el traslado por separado.</p>}
        <button className="primary-action" disabled={busy || target.active === false || (!target.location && !destination) || (!!pending && pending.kind !== 'associate')} onClick={() => void confirm('associate')}>{busy && pending?.kind === 'associate' ? 'Guardando en Odoo…' : pending?.kind === 'associate' ? 'Reintentar confirmación' : 'Confirmar asociación'}</button>
      </> : <p>{pallets.length ? 'Elige un único pallet para asociar las OFs.' : 'Escanea más OFs o el pallet de destino.'}</p>}
    </section>}
    {!!pallets.length && destination && <section className="record-card" aria-label="Traslado pendiente">
      <h2>Cambiar ubicación de pallets</h2>
      <p>Destino: <strong>{destination.code} · {destination.title}</strong></p>
      <ul className="move-summary">{pallets.map(p => <li key={p.id}><strong>{p.code}</strong>: {p.location?.code || 'Sin ubicación'} → {destination.code}{p.location?.id === destination.id ? ' (ya está aquí)' : ''}</li>)}</ul>
      <p>{moving.length ? `Se moverán ${moving.length} pallets; ${pallets.length - moving.length} ya están en el destino.` : 'Todos los pallets seleccionados ya están en esta ubicación.'}</p>
      {!!selected.length && <p>Este traslado cambia la ubicación de los pallets con su contenido actual. Las OFs seleccionadas se asocian por separado.</p>}
      <button className="primary-action" disabled={busy || !moving.length || pallets.some(p => p.active === false) || (!!pending && pending.kind !== 'move')} onClick={() => void confirm('move')}>{busy && pending?.kind === 'move' ? 'Guardando en Odoo…' : pending?.kind === 'move' ? 'Reintentar traslado' : 'Confirmar traslado'}</button>
    </section>}
    {hasSelection && !pending && <button className="quiet-action" disabled={busy} onClick={home}>Cancelar selección</button>}
    {error && <p className="access-error" role="alert">{error}</p>}
    {!record && !error && <div className="scan-empty"><p>Escanea una OF, un pallet o una ubicación.</p></div>}
    {record && <section className="record-card" aria-label="Detalle de la lectura">
      <div className="record-heading"><div><p className="eyebrow">{labels[record.kind]}</p><h2>{record.code}</h2></div><button className="icon-action" disabled={busy || !!pending} onClick={() => void read(codeFor(record), 'refresh')} aria-label="Actualizar consulta">↻</button></div>
      <p className="record-title">{record.title}</p>
      {record.state_label && <span className="role-badge">{record.state_label}</span>}
      {record.active === false && <p className="archived-badge">Archivado</p>}
      {record.kind === 'production' && <dl className="record-facts"><div><dt>Cantidad de la OF</dt><dd>{new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(record.quantity ?? 0)} {record.uom}</dd></div>{record.lot && <div><dt>Lote / serie</dt><dd>{record.lot}</dd></div>}</dl>}
      {record.kind === 'pallet' && <dl className="record-facts"><div><dt>Ubicación</dt><dd>{record.location ? `${record.location.code} · ${record.location.name}` : 'Sin ubicación disponible'}</dd></div></dl>}
      {record.kind === 'pallet' && record.active !== false && <button className="secondary-action" disabled={busy || !!pending} onClick={() => { collector.clear(); setLabelPallet({ id: record.id, code: record.code }); }}>Ver QR / Imprimir etiqueta</button>}
      <h3>{record.kind === 'pallet' ? 'Órdenes de fabricación' : 'Pallets'}</h3>
      {!record.items.length && <p className="empty-relation">{record.kind === 'pallet' ? 'Sin OF disponibles' : 'Sin pallets disponibles'}</p>}
      <ul className="record-list">{record.items.map(item => <li key={`${item.kind}:${item.id}`}><button disabled={busy || !!pending} onClick={() => void read(codeFor(item), 'inspect')}><span><strong>{item.code}</strong><small>{item.kind === 'pallet' ? item.location ? `${item.location.code} · ${item.location.name}` : 'Sin ubicación disponible' : item.title}</small></span><span className="list-status">{item.active === false ? 'Archivado' : item.state_label || 'Ver'} →</span></button></li>)}</ul>
      {record.next_offset !== null && <button className="secondary-action" disabled={busy || !!pending} onClick={() => void read(codeFor(record), 'more')}>Ver más</button>}
    </section>}
    <footer className="scan-footer"><button className="quiet-action" disabled={busy || switching || !!pending} onClick={onChangeAccount}>Cambiar cuenta</button></footer>
    {manual && <div className="modal-backdrop"><section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="manual-title" onKeyDown={event => modalKeys(event, closeManual)}><div className="modal-heading"><h2 id="manual-title">Introducir código</h2><button className="icon-action" aria-label="Cerrar entrada manual" onClick={closeManual}>×</button></div><form onSubmit={submitManual}><label htmlFor="manual-code">OF, pallet o ubicación</label><input id="manual-code" autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} value={manualCode} onChange={event => setManualCode(event.target.value)} required maxLength={256}/><button className="primary-action" disabled={!manualCode.trim()}>Consultar</button></form></section></div>}
    {camera && <Camera onClose={() => setCamera(false)} onRead={code => { setCamera(false); void read(code); }}/>}
  </main>
    {creating && <CreatePalletDialog api={api} token={token} destination={destination} onClose={() => setCreating(false)} onAccessError={onAccessError} onCreated={result => {
      setCreating(false); setTargetId(result.pallet_id); setLabelPallet({ id: result.pallet_id, code: result.pallet_code });
      void read('CMP:PALLET:' + result.pallet_code);
    }}/>}
    {labelPallet && <PalletLabelDialog api={api} token={token} pallet={labelPallet} onClose={() => setLabelPallet(null)} onAccessError={onAccessError}/>}
  </>;
}
