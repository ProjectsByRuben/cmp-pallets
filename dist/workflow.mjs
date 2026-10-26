import { identify, getPallet, addToPallet, movePallet } from './domain.mjs';

export const emptyContext = () => ({ active: null, ofs: [], pending: null });

// Scans select records and prepare a proposal. Only confirmOperation writes data.
export function scanCode(context, raw, data) {
  const item = identify(raw);
  if (context.pending) throw new Error('Confirma o cancela la operación pendiente.');
  const next = structuredClone(context);
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
  return { data: nextData, context: { active: { type: 'pallet', code: operation.pallet }, ofs: [], pending: null }, operation };
}
export function cancelOperation(context) { return { ...context, pending: null }; }
