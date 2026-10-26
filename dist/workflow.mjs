import { identify, getPallet, addToPallet, movePallets } from './domain.mjs';

export const emptyContext = () => ({ active: null, ofs: [], pallets: [], pending: null, intent: null });

export function beginMove(context = emptyContext()) {
  const pallets = context.active?.type === 'pallet' ? [...new Set([...context.pallets, context.active.code])] : [];
  return { ...emptyContext(), active: pallets.length ? { type: 'pallet', code: pallets.at(-1) } : null, pallets, intent: 'move' };
}

export function removeSelectedPallet(context, code) {
  if (context.pending?.type === 'associate') throw new Error('Cancela la asociación para corregir la selección.');
  const pallets = context.pallets.filter(p => p !== code);
  if (!pallets.length) return context.intent === 'move' ? beginMove() : emptyContext();
  return { ...emptyContext(), pallets, active: { type: 'pallet', code: pallets.at(-1) }, intent: 'move' };
}

function moveProposal(data, pallets, location) {
  if (pallets.every(code => getPallet(data, code).location === location)) throw new Error('Los pallets seleccionados ya están en esta ubicación.');
  return { type: 'move', pallets: [...pallets], location };
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
    if (item.type === 'pallet') { next.active = item; next.pallets = [...new Set([...context.pallets, item.code])]; return next; }
    if (!context.pallets.length) throw new Error('Escanea primero el pallet que quieres mover.');
    if (item.type !== 'location') throw new Error('Escanea una ubicación de destino para el pallet.');
    next.pending = moveProposal(data, context.pallets, item.code);
    return next;
  }
  if (item.type === 'of') {
    if (context.active?.type === 'pallet') {
      const pallet = getPallet(data, context.active.code);
      if (!pallet.ofs.includes(item.code)) next.pending = { type: 'associate', ofs: [item.code], pallet: pallet.code };
      else { next.active = item; next.ofs = [item.code]; next.pallets = []; }
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
      next.pallets = [item.code];
      next.pending = moveProposal(data, next.pallets, context.active.code);
    } else {
      next.active = item;
      next.ofs = [];
      next.pallets = [...new Set([...context.pallets, item.code])];
      if (next.pallets.length > 1) next.intent = 'move';
    }
  } else if (context.active?.type === 'pallet') {
    next.pending = moveProposal(data, context.pallets, item.code);
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
    : movePallets(data, operation.pallets, operation.location);
  const code = operation.type === 'associate' ? operation.pallet : operation.pallets[0];
  const nextContext = operation.type === 'move' && operation.pallets.length > 1
    ? { ...emptyContext(), active: { type: 'location', code: operation.location } }
    : { ...emptyContext(), active: { type: 'pallet', code }, pallets: [code] };
  return { data: nextData, context: nextContext, operation };
}
export function cancelOperation(context) { return { ...context, pending: null }; }
