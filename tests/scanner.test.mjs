import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialData, getPallet, palletsForOF, identify } from '../dist/domain.mjs';
import { emptyContext, scanCode, confirmOperation, cancelOperation } from '../dist/workflow.mjs';
import { createHidCollector } from '../dist/hid.mjs';

function scan(context, code, data = initialData()) { return scanCode(context, code, data); }
test('OF → pallet prepara una asociación sin guardar; confirmar conserva los otros pallets', () => {
  const data = initialData();
  let ctx = scan(emptyContext(), 'OF-101', data);
  ctx = scan(ctx, 'OF/26/0042', data);
  ctx = scan(ctx, 'P202600003', data);
  assert.deepEqual(ctx.pending, { type: 'associate', ofs: ['OF-101', 'OF/26/0042'], pallet: 'P202600003' });
  assert.equal(getPallet(data, 'P202600003').ofs.length, 0);
  const result = confirmOperation(ctx, data);
  assert.equal(palletsForOF(result.data, 'OF-101').length, 3);
  assert.equal(result.context.active.code, 'P202600003');
  assert.equal(result.context.pending, null);
  assert.deepEqual(result.context.ofs, []);
  assert.equal(getPallet(data, 'P202600003').ofs.length, 0);
});
test('Pallet → OF prepara la misma asociación', () => {
  const ctx = scan(scan(emptyContext(), 'P202600001'), 'OF/26/0042');
  assert.deepEqual(ctx.pending, { type: 'associate', ofs: ['OF/26/0042'], pallet: 'P202600001' });
});
test('Pallet → ubicación y ubicación → pallet proponen un traslado completo', () => {
  for (const codes of [['P202600001', 'LOC-CALIDAD'], ['LOC-CALIDAD', 'P202600001']]) {
    const ctx = codes.reduce((state, code) => scan(state, code), emptyContext());
    assert.equal(ctx.pending.type, 'move');
    const result = confirmOperation(ctx, initialData());
    assert.equal(getPallet(result.data, 'P202600001').location, 'LOC-CALIDAD');
    assert.deepEqual(getPallet(result.data, 'P202600001').ofs, ['OF-101']);
    assert.equal(getPallet(result.data, 'P202600002').location, 'LOC-CORTE');
  }
});
test('Relecturas no duplican; pallet → pallet acumula selección; todos en destino no opera', () => {
  const one = scan(emptyContext(), 'OF/26/0042');
  assert.equal(scan(one, 'OF/26/0042').ofs.length, 1);
  let pallet = scan(emptyContext(), 'P202600001');
  pallet = scan(pallet, 'P202600002');
  assert.equal(pallet.active.code, 'P202600002'); assert.equal(pallet.pending, null);
  assert.deepEqual(pallet.pallets, ['P202600001', 'P202600002']);
  assert.equal(pallet.intent, 'move');
  assert.equal(scan(pallet, 'LOC-CORTE').pending.type, 'move');
  assert.throws(() => scan(scan(emptyContext(), 'P202600002'), 'LOC-CORTE'), /ya está/);
});
test('Cancelar y códigos erróneos no cambian datos ni seleccionados; pendiente bloquea nuevas lecturas', () => {
  const original = initialData();
  const one = scan(emptyContext(), 'OF/26/0042');
  const pending = scan(one, 'P202600001');
  assert.throws(() => scan(pending, 'P202600003'), /pendiente/);
  assert.throws(() => scan(one, 'LOC-CORTE'), /Escanea un pallet/);
  assert.throws(() => scan(one, 'DESCONOCIDO'));
  assert.deepEqual(cancelOperation(pending), one);
  assert.deepEqual(original, initialData());
  assert.throws(() => confirmOperation(one, original), /pendiente/);
});
test('Las asociaciones ya existentes no preparan escrituras duplicadas', () => {
  const one = scan(emptyContext(), 'OF-101');
  assert.throws(() => scan(one, 'P202600001'), /ya están/);
  const existing = scan(scan(emptyContext(), 'P202600001'), 'OF-101');
  assert.equal(existing.active.type, 'of');
  assert.equal(existing.active.code, 'OF-101');
  assert.equal(existing.pending, null);
});

function hidFixture(onRead) {
  let clock = 0, timerId = 0;
  const timers = new Map(), reads = [], partials = [];
  const hid = createHidCollector({
    onRead: value => { reads.push(value); onRead?.(value); },
    isKnown: value => { try { identify(value); return true; } catch { return false; } },
    onPartial: value => partials.push(value),
    now: () => clock,
    schedule: fn => { timers.set(++timerId, fn); return timerId; },
    unschedule: id => timers.delete(id),
  });
  function key(key, options = {}) {
    let prevented = false;
    const handled = hid.key({ key, preventDefault: () => { prevented = true; }, ...options });
    return { handled, prevented };
  }
  return { hid, reads, partials, timers, key,
    tick: () => { clock += 600; const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); },
  };
}
test('HID recibe texto y Enter/Tab sin botón, absorbe CRLF y no activa confirmación por teclado', () => {
  const f = hidFixture();
  f.hid.setValue('OF/26/0042'); assert.equal(f.key('Enter').prevented, true);
  assert.deepEqual(f.reads, ['OF/26/0042']);
  assert.equal(f.key('Enter').prevented, true); assert.equal(f.reads.length, 1);
  f.hid.setValue('P202600001'); assert.equal(f.key('Tab').prevented, true);
  assert.deepEqual(f.reads, ['OF/26/0042', 'P202600001']); assert.equal(f.hid.value, '');
  f.tick(); assert.equal(f.key('Enter').prevented, false);
});
test('HID sin sufijo sólo completa códigos conocidos tras pausa; admite input/paste de iOS', () => {
  const f = hidFixture();
  f.hid.setValue('OF/26/'); f.tick(); assert.equal(f.reads.length, 0);
  f.hid.setValue('of/26/0042'); f.tick(); assert.deepEqual(f.reads, ['of/26/0042']);
  f.hid.setValue('https://example.com'); f.tick(); assert.equal(f.reads.length, 1);
  f.key('Enter'); assert.equal(f.reads.at(-1), 'https://example.com');
});
test('HID limpia parciales al salir, limita tamaño y respeta modificadores', () => {
  const f = hidFixture(); f.hid.setValue('OF/26/0042');
  assert.equal(f.key('Enter', { ctrlKey: true }).handled, false); assert.equal(f.reads.length, 0);
  f.hid.clear(); f.tick(); assert.equal(f.reads.length, 0);
  f.hid.setValue('x'.repeat(500)); assert.equal(f.hid.value.length, 256);
  f.key('Escape'); assert.equal(f.hid.value, ''); assert.equal(f.timers.size, 0);
});
test('Secuencia de teclado OF → pallet → Enter nunca escribe hasta confirmar explícitamente', () => {
  const data = initialData(); let ctx = emptyContext();
  const f = hidFixture(raw => { ctx = scanCode(ctx, raw, data); });
  f.hid.setValue('OF/26/0042'); f.key('Enter');
  f.hid.setValue('P202600001'); f.key('Enter'); f.key('Enter');
  assert.equal(ctx.pending.type, 'associate');
  assert.deepEqual(getPallet(data, 'P202600001').ofs, ['OF-101']);
  assert.equal(getPallet(confirmOperation(ctx, data).data, 'P202600001').ofs.includes('OF/26/0042'), true);
});
