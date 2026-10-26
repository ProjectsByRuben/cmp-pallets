import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialData, getPallet } from '../dist/domain.mjs';
import { emptyContext, beginMove, removeSelectedOF, scanCode, confirmOperation } from '../dist/workflow.mjs';
import { createNavigation } from '../dist/navigation.mjs';

const read = (nav, code, data) => nav.visit(scanCode(nav.current, code, data));

test('Volver quita la última OF, cancela el pallet propuesto y termina en Inicio sin guardar', () => {
  const nav = createNavigation(emptyContext), data = initialData();
  read(nav, 'OF/26/0042', data); read(nav, 'OF/26/0043', data); read(nav, 'P202600001', data);
  assert.equal(nav.current.pending.type, 'associate');
  nav.back(); assert.deepEqual(nav.current.ofs, ['OF/26/0042', 'OF/26/0043']); assert.equal(nav.current.pending, null);
  nav.back(); assert.deepEqual(nav.current.ofs, ['OF/26/0042']);
  nav.back(); assert.deepEqual(nav.current, emptyContext()); assert.equal(nav.canGoBack, false);
  assert.deepEqual(data, initialData());
});

test('Inicio descarta selección y propuesta y vacía navegación sin tocar datos', () => {
  const nav = createNavigation(emptyContext), data = initialData();
  read(nav, 'P202600001', data); read(nav, 'LOC-CALIDAD', data);
  assert.equal(nav.current.pending.type, 'move');
  nav.home(); assert.deepEqual(nav.current, emptyContext());
  assert.equal(nav.canGoBack, false); assert.deepEqual(nav.back(), emptyContext());
  assert.equal(getPallet(data, 'P202600001').location, 'LOC-MONTAJE');
});

test('Mover pallet guía ambas selecciones, permite corregir pallet y rechaza OFs y ubicación actual', () => {
  const nav = createNavigation(emptyContext), data = initialData();
  nav.visit(beginMove());
  assert.throws(() => read(nav, 'LOC-CALIDAD', data), /primero el pallet/);
  read(nav, 'P202600002', data); read(nav, 'P202600001', data);
  assert.equal(nav.current.active.code, 'P202600001');
  assert.throws(() => read(nav, 'OF/26/0042', data), /ubicación de destino/);
  assert.throws(() => read(nav, 'LOC-MONTAJE', data), /ya está/);
  read(nav, 'LOC-CALIDAD', data);
  nav.back(); assert.equal(nav.current.intent, 'move'); assert.equal(nav.current.pending, null);
  read(nav, 'LOC-CORTE', data);
  const result = confirmOperation(nav.current, data);
  assert.equal(getPallet(result.data, 'P202600001').location, 'LOC-CORTE');
  assert.deepEqual(getPallet(result.data, 'P202600001').ofs, ['OF-101']);
  assert.deepEqual(data, initialData());
});

test('Mover desde una ficha conserva el pallet y Volver regresa a esa ficha', () => {
  const nav = createNavigation(emptyContext), data = initialData();
  read(nav, 'P202600002', data);
  const detail = structuredClone(nav.current);
  nav.visit(beginMove(nav.current));
  assert.equal(nav.current.active.code, 'P202600002'); assert.equal(nav.current.intent, 'move');
  assert.deepEqual(nav.back(), detail);
});

test('Quitar lectura elimina también la única OF seleccionada sin desasociar datos guardados', () => {
  const data = initialData();
  let ctx = scanCode(emptyContext(), 'OF-101', data);
  ctx = scanCode(ctx, 'OF/26/0042', data);
  ctx = removeSelectedOF(ctx, 'OF/26/0042');
  assert.equal(ctx.active.code, 'OF-101'); assert.deepEqual(ctx.ofs, ['OF-101']);
  assert.deepEqual(removeSelectedOF(ctx, 'OF-101'), emptyContext());
  assert.deepEqual(getPallet(data, 'P202600001').ofs, ['OF-101']);
  assert.throws(() => removeSelectedOF(scanCode(ctx, 'P202600003', data), 'OF-101'), /Cancela/);
});

test('Tras confirmar, Volver conduce a Inicio y no restaura una propuesta ni revierte datos', () => {
  const nav = createNavigation(emptyContext); let data = initialData();
  read(nav, 'OF/26/0042', data); read(nav, 'P202600003', data);
  const saved = confirmOperation(nav.current, data); data = saved.data;
  nav.restart(saved.context); nav.back();
  assert.deepEqual(nav.current, emptyContext()); assert.equal(nav.canGoBack, false);
  assert.deepEqual(getPallet(data, 'P202600003').ofs, ['OF/26/0042']);
});
