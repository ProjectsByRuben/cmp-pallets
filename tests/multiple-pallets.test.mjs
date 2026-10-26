import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialData, getPallet, movePallets, validateData, palletsForOF } from '../dist/domain.mjs';
import { emptyContext, beginMove, removeSelectedPallet, scanCode, confirmOperation } from '../dist/workflow.mjs';
import { createNavigation } from '../dist/navigation.mjs';

function reads(context, codes, data = initialData()) {
  return codes.reduce((ctx, code) => scanCode(ctx, code, data), context);
}

test('Dos pallets → ubicación prepara un solo traslado, tanto desde Inicio como desde Mover pallets', () => {
  for (const start of [emptyContext(), beginMove()]) {
    const data = initialData();
    const ctx = reads(start, ['P202600001', 'P202600002', 'LOC-CALIDAD'], data);
    assert.deepEqual(ctx.pending, { type: 'move', pallets: ['P202600001', 'P202600002'], location: 'LOC-CALIDAD' });
    assert.deepEqual(data, initialData());
    const result = confirmOperation(ctx, data);
    assert.equal(getPallet(result.data, 'P202600001').location, 'LOC-CALIDAD');
    assert.equal(getPallet(result.data, 'P202600002').location, 'LOC-CALIDAD');
    assert.equal(result.data.history.length, 1);
    assert.deepEqual(palletsForOF(result.data, 'OF-101').map(p => p.location), ['LOC-CALIDAD', 'LOC-CALIDAD']);
    assert.deepEqual(result.context.active, { type: 'location', code: 'LOC-CALIDAD' });
    assert.equal(validateData(result.data), true);
  }
});

test('Quitar uno antes de leer ubicación sólo mueve el restante y permite volver a añadirlo', () => {
  const original = initialData();
  const two = reads(beginMove(), ['P202600001', 'P202600002']);
  const one = removeSelectedPallet(two, 'P202600002');
  assert.deepEqual(one.pallets, ['P202600001']);
  const result = confirmOperation(reads(one, ['LOC-CALIDAD']), original);
  assert.equal(getPallet(result.data, 'P202600001').location, 'LOC-CALIDAD');
  assert.equal(getPallet(result.data, 'P202600002').location, 'LOC-CORTE');
  assert.deepEqual(reads(one, ['P202600002']).pallets, ['P202600001', 'P202600002']);
  assert.deepEqual(two.pallets, ['P202600001', 'P202600002']);
  assert.deepEqual(original, initialData());
});

test('Quitar desde confirmación borra el destino pendiente y exige elegirlo otra vez', () => {
  const ctx = reads(beginMove(), ['P202600001', 'P202600002', 'LOC-CALIDAD']);
  const corrected = removeSelectedPallet(ctx, 'P202600001');
  assert.equal(corrected.pending, null); assert.deepEqual(corrected.pallets, ['P202600002']);
  assert.throws(() => confirmOperation(corrected, initialData()), /pendiente/);
  const result = confirmOperation(reads(corrected, ['LOC-MONTAJE']), initialData());
  assert.equal(getPallet(result.data, 'P202600002').location, 'LOC-MONTAJE');
  assert.equal(getPallet(result.data, 'P202600001').location, 'LOC-MONTAJE');
});

test('Quitar el último pallet permite empezar otra selección y las relecturas no lo duplican', () => {
  let ctx = reads(beginMove(), ['P202600001', 'P202600001']);
  assert.deepEqual(ctx.pallets, ['P202600001']);
  ctx = removeSelectedPallet(ctx, 'P202600001');
  assert.deepEqual(ctx, beginMove());
  assert.throws(() => reads(ctx, ['LOC-CALIDAD']), /primero el pallet/);
  ctx = reads(ctx, ['P202600003', 'LOC-CORTE']);
  const result = confirmOperation(ctx, initialData());
  assert.equal(getPallet(result.data, 'P202600003').location, 'LOC-CORTE');
  assert.equal(result.context.active.code, 'P202600003');
  assert.deepEqual(removeSelectedPallet(reads(emptyContext(), ['P202600001']), 'P202600001'), emptyContext());
});

test('Los pallets que ya estén en destino no se modifican y todos allí es un error sin escritura', () => {
  const data = initialData();
  const next = movePallets(data, ['P202600001', 'P202600002', 'P202600002'], 'LOC-MONTAJE');
  assert.equal(getPallet(next, 'P202600002').location, 'LOC-MONTAJE');
  assert.deepEqual(getPallet(next, 'P202600001'), getPallet(data, 'P202600001'));
  assert.equal(next.history.length, 1); assert.match(next.history[0].text, /P202600002/);
  assert.doesNotMatch(next.history[0].text, /P202600001/);
  assert.throws(() => movePallets(next, ['P202600001', 'P202600002'], 'LOC-MONTAJE'), /ya están/);
});

test('Un pallet inválido o destino desconocido invalida todo el grupo sin mover el resto', () => {
  const data = initialData();
  assert.throws(() => movePallets(data, ['P202600001', 'NO-EXISTE'], 'LOC-CALIDAD'));
  assert.throws(() => movePallets(data, ['P202600001', 'P202600002'], 'NO-EXISTE'));
  assert.throws(() => movePallets(data, [], 'LOC-CALIDAD'));
  assert.deepEqual(data, initialData());
});

test('Volver restaura la selección anterior e Inicio descarta el traslado sin alterar pallets', () => {
  const nav = createNavigation(emptyContext), data = initialData();
  nav.visit(beginMove());
  for (const code of ['P202600001', 'P202600002', 'LOC-CALIDAD']) nav.visit(scanCode(nav.current, code, data));
  nav.back(); assert.deepEqual(nav.current.pallets, ['P202600001', 'P202600002']);
  nav.back(); assert.deepEqual(nav.current.pallets, ['P202600001']);
  nav.home(); assert.deepEqual(nav.current, emptyContext());
  assert.deepEqual(data, initialData());
});
