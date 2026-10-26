import { identify, getPallet, addToPallet, movePallet } from './domain.mjs';

export const emptyContext = () => ({ active: null, ofs: [], pending: null, intent: null });

export function beginMove(context = emptyContext()) {
  return { ...emptyContext(), active: context.active?.type === 'pallet' ? structuredClone(context.active) : null, intent: 'move' };
}

export function removeSelectedOF(context, code) {
  if (context.pending) throw new Error('Cancela la operación para corregir la selección.');
  const ofs = context.ofs.filter(of => of !== code);
  return ofs.length ? { ...context, ofs, active: { type: 'of', code: ofs.at(-1) } } : emptyContext();
}

// Scans select records and prepare a proposal. Only confirmOperation writes data.
export function scanCode(context, raw, data) {
  const item = identify(raw);
  if (context.pending) throw new Error('Confirma o cancela la operación pendiente.');
  const next = structuredClone(context);
  if (context.intent === 'move') {
    if (item.type === 'pallet') { next.active = item; return next; }
    if (!context.active) throw new Error('Escanea primero el pallet que quieres mover.');
    if (item.type !== 'location') throw new Error('Escanea una ubicación de destino para el pallet.');
    if (getPallet(data, context.active.code).location === item.code) throw new Error('El pallet ya está en esta ubicación.');
    next.pending = { type: 'move', pallet: context.active.code, location: item.code };
    return next;
  }
  if (item.type === 'of') {
    if (context.active?.type === 'pallet') {
      const pallet = getPallet(data, context.active.code);
      if (!pallet.ofs.includes(item.code)) next.pending = { type: 'associate', ofs: [item.code], pallet: pallet.code };
      else { next.active = item; next.ofs = [item.code]; }
    } else {
      next.ofs = [...new Set([...context.ofs, item.code])];
      next.active = item;
    }
  } else if (item.type === 'pallet') {
    if (context.ofs.length) {
      const pallet = getPallet(data, item.code);
      const missing = context.ofs.filter(code => !pallet.ofs.includes(code));
      if (!missing.length) throw new Error('Las OFs seleccionadas ya están en este pallet.');
      next.pending = { type: 'associate', ofs: missing, pallet: item.code };
    } else if (context.active?.type === 'location') {
      if (getPallet(data, item.code).location === context.active.code) throw new Error('El pallet ya está en esta ubicación.');
      next.pending = { type: 'move', pallet: item.code, location: context.active.code };
    } else {
      next.active = item;
      next.ofs = [];
    }
  } else if (context.active?.type === 'pallet') {
    if (getPallet(data, context.active.code).location === item.code) throw new Error('El pallet ya está en esta ubicación.');
    next.pending = { type: 'move', pallet: context.active.code, location: item.code };
  } else {
    if (context.ofs.length) throw new Error('Escanea un pallet para las OFs seleccionadas.');
    next.active = item;
    next.ofs = [];
  }
  return next;
}

export function confirmOperation(context, data) {
  const operation = context.pending;
  if (!operation) throw new Error('No hay una operación pendiente.');
  const nextData = operation.type === 'associate'
    ? addToPallet(data, operation.ofs, operation.pallet)
    : movePallet(data, operation.pallet, operation.location);
  return { data: nextData, context: { ...emptyContext(), active: { type: 'pallet', code: operation.pallet } }, operation };
}
export function cancelOperation(context) { return { ...context, pending: null }; }
