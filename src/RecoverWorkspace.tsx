import { useEffect, useState, type ComponentProps } from 'react';
import { ApiError, type ScanRecord } from './api';
import { clearWork, readWork, type SavedWork } from './tabState';
import { ScanWorkspace } from './ScanWorkspace';

const prefix = { production: 'OF', pallet: 'PALLET', location: 'LOC' };
export function RecoverWorkspace(props: ComponentProps<typeof ScanWorkspace>) {
  const [saved] = useState(() => readWork(props.token));
  const [restored, setRestored] = useState<SavedWork | null>(null);
  const [loading, setLoading] = useState(!!saved);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!saved || dismissed) return;
    let cancelled = false;
    let stopped = false;
    setLoading(true); setError('');
    const refs = new Map<string, { kind: ScanRecord['kind']; id: number; code: string }>();
    function add(r: { kind: ScanRecord['kind']; id: number; code: string } | null) {
      if (r) refs.set(`${r.kind}:${r.id}`, r);
    }
    for (const r of [...saved.selected, ...saved.pallets, saved.record, saved.destination]) add(r);
    if (saved.creation?.location) add({ ...saved.creation.location, kind: 'location' });
    const fresh = new Map<string, ScanRecord>();
    const queue = [...refs.values()];
    async function worker() {
      while (queue.length && !cancelled && !stopped) {
        const r = queue.shift()!;
        const result = await props.api.lookup(props.token, `CMP:${prefix[r.kind]}:${r.code}`);
        if (!result.ok || result.record.id !== r.id || result.record.kind !== r.kind) throw new Error('Un registro pendiente ya no está disponible. Revisa el acceso o cancela la selección.');
        fresh.set(`${r.kind}:${r.id}`, result.record);
      }
    }
    Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker())).then(() => {
      if (cancelled) return;
      const current = (r: ScanRecord | null) => r ? fresh.get(`${r.kind}:${r.id}`)! : null;
      setRestored({ ...saved, selected: saved.selected.map(r => current(r)!), pallets: saved.pallets.map(r => current(r)!),
        record: current(saved.record),
        destination: !saved.pending && saved.destination && current(saved.destination)?.active === false ? null : current(saved.destination),
        needsLocation: !saved.pending && saved.needsLocation && fresh.get(`pallet:${saved.needsLocation}`)?.location ? null : saved.needsLocation,
        creation: saved.creation && !saved.creation.proposal && saved.creation.location
          && fresh.get(`location:${saved.creation.location.id}`)?.active === false ? { ...saved.creation, location: null } : saved.creation });
      setLoading(false);
    }).catch(reason => {
      stopped = true;
      if (cancelled) return;
      if (reason instanceof ApiError && ['access', 'session'].includes(reason.kind)) props.onAccessError(reason);
      else { setError(reason instanceof Error ? reason.message : 'No se ha podido recuperar la selección.'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [attempt, dismissed]);
  if (saved && !dismissed && (loading || error)) return <main className="access-main"><section className="access-card">
    <h1>Recuperar trabajo</h1>{loading ? <p role="status">Comprobando los registros pendientes con Odoo…</p> : <>
      <p role="alert">{error}</p><button className="primary-action" onClick={() => setAttempt(n => n + 1)}>Reintentar recuperación</button>
      {!saved.pending && !saved.creation?.proposal && <button className="secondary-action" onClick={() => { clearWork(); setRestored(null); setLoading(false); setError(''); setDismissed(true); }}>Descartar selección</button>}
      <p>La selección y las peticiones pendientes se conservan. No se ha enviado ninguna operación nueva.</p>
      <button className="quiet-action" onClick={props.onChangeAccount}>Cambiar cuenta y descartar selección</button>
    </>}
  </section></main>;
  return <ScanWorkspace {...props} initialState={dismissed ? undefined : restored ?? undefined}/>;
}
