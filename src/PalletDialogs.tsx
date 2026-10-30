import { useEffect, useRef, useState } from 'react';
import { ApiError, type AccessApi, type PalletCreated, type PalletCreation, type PalletLabel, type ScanRecord } from './api';
import { LocationPicker } from './LocationPicker';
import { modalKeys } from './modal';

type Common = { api: AccessApi; token: string; onClose(): void; onAccessError(error: ApiError): void };

export function CreatePalletDialog({ api, token, destination, onClose, onCreated, onAccessError }: Common & {
  destination: ScanRecord | null; onCreated(result: PalletCreated): void;
}) {
  const [location, setLocation] = useState(destination && destination.active !== false ? { id: destination.id, code: destination.code, name: destination.title } : null);
  const [proposal, setProposal] = useState<PalletCreation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const locked = busy || !!proposal;
  const close = () => { if (!locked) onClose(); };

  async function create() {
    if (running.current) return;
    const request = proposal ?? { request_id: crypto.randomUUID(), ...(location ? { location_id: location.id } : {}) };
    running.current = true; setProposal(request); setBusy(true); setError('');
    try {
      const result = await api.createPallet(token, request);
      onCreated(result);
    } catch (reason) {
      if (reason instanceof ApiError && reason.kind !== 'network') {
        setProposal(null);
        if (reason.kind === 'business') setError(reason.message);
        else onAccessError(reason);
      } else setError('No se ha confirmado la creación. Reintenta la misma petición para evitar duplicados.');
    } finally { running.current = false; setBusy(false); }
  }

  return <div className="modal-backdrop"><section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="create-pallet-title" onKeyDown={event => modalKeys(event, close)}>
    <div className="modal-heading"><h2 id="create-pallet-title">Crear pallet</h2><button className="icon-action" aria-label="Cerrar creación" disabled={locked} onClick={close}>×</button></div>
    <p>Odoo asignará el siguiente código. El pallet se creará vacío y después podrás imprimir su etiqueta.</p>
    <LocationPicker autoFocus api={api} token={token} value={location} onChange={setLocation} disabled={locked} onAccessError={onAccessError}/>
    {!location && <p>Se creará sin ubicación. Al escanearlo para trabajar, deberás elegir una ubicación antes de continuar.</p>}
    <p>Las OFs seleccionadas se conservarán para asociarlas después de crear el pallet.</p>
    {error && <p className="access-error" role="alert">{error}</p>}
    <button className="primary-action" disabled={busy} onClick={() => void create()}>{busy ? 'Creando en Odoo…' : proposal ? 'Reintentar creación' : 'Crear pallet y ver etiqueta'}</button>
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
    <p className="print-help">Etiqueta de 100 × 60 mm en hoja A4. Imprime al 100 %, sin encabezados ni pies. También puedes guardar como PDF.</p>
    {error ? <><p className="access-error" role="alert">{error}</p><button className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Reintentar etiqueta</button></> : !label ? <p role="status">Preparando QR…</p> : <>
      <div className="pallet-label" aria-label={`Etiqueta de ${label.code}`}>
        <img src={'data:image/png;base64,' + label.png_base64} alt={`QR del pallet ${label.code}`} onLoad={() => setReady(true)} onError={() => { setReady(false); setError('No se pudo cargar el QR. Reintenta la etiqueta.'); }}/>
        <div><span>PALLET</span><strong>{label.code}</strong><small>Escanea para consultar y operar</small></div>
      </div>
      <div className="label-actions"><button className="primary-action" disabled={!ready} onClick={() => window.print()}>Imprimir etiqueta / Guardar PDF</button>
        <a className="quiet-action" href={'data:image/png;base64,' + label.png_base64} download={`${label.code}-QR.png`}>Descargar QR</a></div>
      <p className="print-help">Reimprimir conserva el mismo código y no crea otro pallet. La ubicación y las OFs se consultan en la aplicación.</p>
    </>}
  </section></div>;
}
