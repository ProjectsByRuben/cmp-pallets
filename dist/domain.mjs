export const OFS = Object.freeze([
  { code: 'OF/26/0042', name: 'Placa de unión' },
  { code: 'OF/26/0043', name: 'Marco superior' },
  { code: 'OF-101', name: 'Soporte lateral' },
]);
export const LOCATIONS = Object.freeze([
  { code: 'LOC-MONTAJE', name: 'Montaje' },
  { code: 'LOC-CORTE', name: 'Corte' },
  { code: 'LOC-CALIDAD', name: 'Control de calidad' },
]);
export const PALLET_CODES = Object.freeze(['P202600001', 'P202600002', 'P202600003']);
export const STORAGE_KEY = 'cmp-pallets-camera-demo-v1';
export function initialData() {
  return { version: 1, pallets: [
    { code: PALLET_CODES[0], location: 'LOC-MONTAJE', ofs: ['OF-101'] },
    { code: PALLET_CODES[1], location: 'LOC-CORTE', ofs: ['OF-101'] },
    { code: PALLET_CODES[2], location: 'LOC-CALIDAD', ofs: [] },
  ], history: [] };
}
export const ofName = code => OFS.find(of => of.code === code)?.name || code;
export const locationName = code => LOCATIONS.find(loc => loc.code === code)?.name || code;
export function identify(raw) {
  const code = String(raw).trim().toUpperCase();
  if (OFS.some(of => of.code === code)) return { type: 'of', code };
  if (PALLET_CODES.includes(code)) return { type: 'pallet', code };
  if (LOCATIONS.some(loc => loc.code === code)) return { type: 'location', code };
  throw new Error('Este QR no pertenece a la prueba. Usa las etiquetas de «Códigos de prueba».');
}
export function validateData(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.pallets) || data.pallets.length !== 3 || !Array.isArray(data.history)) return false;
  const seen = new Set();
  for (const p of data.pallets) {
    if (!PALLET_CODES.includes(p.code) || seen.has(p.code) || !LOCATIONS.some(l => l.code === p.location) || !Array.isArray(p.ofs) || new Set(p.ofs).size !== p.ofs.length || p.ofs.some(code => !OFS.some(of => of.code === code))) return false;
    seen.add(p.code);
  }
  return data.history.every(e => e && typeof e.text === 'string' && e.text.length < 1000 && typeof e.at === 'string') && data.history.length <= 30;
}
export function getPallet(data, code) {
  const p = data.pallets.find(pallet => pallet.code === code);
  if (!p) throw new Error('No se encuentra ese pallet de prueba.');
  return p;
}
export function palletsForOF(data, code) { return data.pallets.filter(p => p.ofs.includes(code)); }
export function addToPallet(data, ofCodes, palletCode) {
  if (!ofCodes.length || ofCodes.some(code => !OFS.some(of => of.code === code))) throw new Error('Escanea al menos una OF de prueba.');
  getPallet(data, palletCode);
  const next = structuredClone(data);
  const p = getPallet(next, palletCode);
  p.ofs = [...new Set([...p.ofs, ...ofCodes])];
  next.history.unshift({ text: [...new Set(ofCodes)].join(', ') + ' → ' + palletCode + ' · ' + locationName(p.location), at: new Date().toISOString() });
  next.history = next.history.slice(0, 30);
  return next;
}
export function movePallet(data, palletCode, locationCode) {
  getPallet(data, palletCode);
  if (!LOCATIONS.some(l => l.code === locationCode)) throw new Error('Escanea una ubicación de prueba.');
  const next = structuredClone(data);
  getPallet(next, palletCode).location = locationCode;
  next.history.unshift({ text: palletCode + ' → ' + locationName(locationCode), at: new Date().toISOString() });
  next.history = next.history.slice(0, 30);
  return next;
}

export function movePallets(data, palletCodes, locationCode) {
  const codes = [...new Set(palletCodes)];
  if (!codes.length) throw new Error('Selecciona al menos un pallet.');
  if (!LOCATIONS.some(l => l.code === locationCode)) throw new Error('Escanea una ubicación de prueba.');
  // Validate the entire selection before creating any changed state.
  const changed = codes.filter(code => getPallet(data, code).location !== locationCode);
  if (!changed.length) throw new Error('Los pallets seleccionados ya están en esta ubicación.');
  const next = structuredClone(data);
  for (const code of changed) getPallet(next, code).location = locationCode;
  next.history.unshift({ text: changed.join(', ') + ' → ' + locationName(locationCode), at: new Date().toISOString() });
  next.history = next.history.slice(0, 30);
  return next;
}
