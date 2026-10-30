import { useEffect, useId, useRef, useState } from 'react';
import { useReaderFocus } from './useReaderFocus';
import { ApiError, type AccessApi, type LocationPage, type LocationSummary } from './api';

export function LocationPicker({ api, token, value, onChange, disabled = false, autoFocus = false, onAccessError }: {
  api: AccessApi; token: string; value: LocationSummary | null; onChange(location: LocationSummary | null): void;
  disabled?: boolean; autoFocus?: boolean; onAccessError(error: ApiError): void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<LocationPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const reading = useRef(false);
  const queryRef = useRef(query);
  queryRef.current = query;
  const [collector] = useState(() => ({ get value() { return queryRef.current; }, setValue: setQuery, clear: () => setQuery('') }));
  const { readerState } = useReaderFocus(input, autoFocus && !disabled, collector);
  function fail(reason: unknown) {
    if (reason instanceof ApiError && ['session', 'access'].includes(reason.kind)) onAccessError(reason);
    else setError(reason instanceof Error ? reason.message : 'No se pudo consultar la ubicación.');
  }
  useEffect(() => {
    const current = ++version.current;
    setPage(null); setError(''); setBusy(false);
    if (disabled) return;
    const timer = setTimeout(() => {
      if (current !== version.current) return;
      setBusy(true);
      api.locations(token, query).then(result => { if (current === version.current) setPage(result); })
        .catch(reason => { if (current === version.current) fail(reason); })
        .finally(() => { if (current === version.current) setBusy(false); });
    }, 200);
    return () => { clearTimeout(timer); version.current++; };
  }, [api, token, query, retry, disabled]);

  async function more() {
    if (disabled || busy || page?.next_offset == null) return;
    const current = version.current;
    setBusy(true); setError('');
    try {
      const result = await api.locations(token, query, page.next_offset);
      if (current === version.current) setPage({ ...result, items: [...page.items, ...result.items] });
    } catch (reason) { if (current === version.current) fail(reason); }
    finally { if (current === version.current) setBusy(false); }
  }
  async function scan() {
    if (disabled || reading.current || !query.trim()) return;
    reading.current = true;
    const current = ++version.current;
    setBusy(true); setError('');
    try {
      const result = await api.lookup(token, query.trim());
      if (current !== version.current) return;
      if (!result.ok) { setError(result.error); return; }
      if (result.record.kind !== 'location' || result.record.active === false) { setError('Escanea una ubicación activa. Esta lectura no se ha añadido.'); return; }
      onChange({ id: result.record.id, code: result.record.code, name: result.record.title });
      setQuery('');
    } catch (reason) { if (current === version.current) fail(reason); }
    finally { reading.current = false; if (current === version.current) setBusy(false); }
  }
  return <div className="location-picker">
    {autoFocus && <p className="reader-indicator" role="status" aria-label="Estado del lector de ubicación" data-ready={readerState === 'ready'}><span aria-hidden="true"/>{readerState === 'ready' ? 'Preparado para escanear ubicación' : readerState === 'inactive' ? 'Activa esta ventana para escanear' : readerState === 'paused' ? 'Lector en pausa' : 'Selecciona el campo para escanear'}</p>}
    <label htmlFor={id}>Buscar o escanear ubicación existente</label>
    <form onSubmit={event => { event.preventDefault(); void scan(); }}>
      <input ref={input} autoFocus={autoFocus} id={id} value={query} disabled={disabled} maxLength={100} autoComplete="off" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Tab' && query.trim()) { event.preventDefault(); void scan(); } }} placeholder="Código o nombre de ubicación"/>
      <button className="quiet-action" disabled={disabled || busy || !query.trim()}>Consultar código</button>
    </form>
    {value && <p>Ubicación elegida: <strong>{value.code} · {value.name}</strong> <button type="button" className="quiet-action" disabled={disabled} onClick={() => onChange(null)}>Sin ubicación</button></p>}
    {busy && <p role="status">Buscando ubicaciones…</p>}
    {error && <p className="access-error" role="alert">{error} <button type="button" className="quiet-action" disabled={disabled || busy} onClick={() => setRetry(n => n + 1)}>Reintentar búsqueda</button></p>}
    <ul className="location-options">{page?.items.map(item => <li key={item.id}><button type="button" className="selected-record" disabled={disabled || busy} aria-label={`Elegir ubicación ${item.code}`} aria-pressed={value?.id === item.id} onClick={() => onChange(item)}><strong>{item.code}</strong><span>{item.name}</span></button></li>)}</ul>
    {page && !page.items.length && !busy && <p>No hay ubicaciones disponibles para esta búsqueda.</p>}
    {page?.next_offset != null && <button type="button" className="quiet-action" disabled={disabled || busy} onClick={() => void more()}>Más ubicaciones</button>}
  </div>;
}
