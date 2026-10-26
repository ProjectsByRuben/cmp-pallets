import { OFS, LOCATIONS, STORAGE_KEY, initialData, validateData, identify, getPallet, palletsForOF, ofName, locationName } from './domain.mjs';
import { createReader } from './camera.mjs';
import { emptyContext, scanCode, confirmOperation, beginMove, removeSelectedOF, removeSelectedPallet } from './workflow.mjs';
import { createNavigation } from './navigation.mjs';
import { createHidCollector } from './hid.mjs';
import { icon } from './icons.mjs';

for (const element of document.querySelectorAll('[data-icon]')) element.innerHTML = icon(element.dataset.icon);

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const navigation = createNavigation(emptyContext);
let data = initialData(), context = navigation.current, storageNote = '';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (validateData(parsed)) data = parsed;
    else storageNote = 'Los datos guardados no son válidos. Se han cargado los datos iniciales.';
  }
} catch { storageNote = 'Almacenamiento no disponible. Los cambios sólo durarán en esta pestaña.'; }
let lastScan = '', lastAt = -Infinity;
function notice(message = '', error = false) {
  $('notice').hidden = !message;
  $('notice').textContent = message;
  $('notice').className = 'notice' + (error ? ' error' : '');
}
function commit(next) {
  data = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return true; }
  catch { return false; }
}
function hasDialog() { return !!document.querySelector('dialog[open]'); }
function focusReader() { if (!hasDialog() && !document.hidden) $('reader-code').focus({ preventScroll: true }); updateStatus(); }
function updateStatus() {
  const paused = document.hidden || !document.hasFocus();
  const status = paused ? 'Activa esta página para leer' : hasDialog() ? 'Lector en pausa' : 'Preparado para escanear';
  $('reader-status').textContent = status;
  document.querySelector('.reader-status').classList.toggle('paused', paused || hasDialog());
}
function linkRow(code, title, badge = '', simulateScan = false) {
  return `<button type="button" class="item-row" ${simulateScan ? 'data-code' : 'data-record'}="${esc(code)}"><span><strong>${esc(code)}</strong><small>${esc(title)}</small></span>${badge ? `<span class="count">${esc(badge)}</span>` : ''}<span class="chevron">${icon('chevron')}</span></button>`;
}
function palletRows(pallets, simulateScan = false) {
  return pallets.length ? pallets.map(p => linkRow(p.code, locationName(p.location), `${p.ofs.length} OF`, simulateScan)).join('') : '<p class="empty-line">Sin pallet registrado</p>';
}
function selectedPalletRows(codes, destination = null) {
  return codes.map(code => {
    const p = getPallet(data, code);
    return `<div class="selected-pallet"><div><strong>${esc(code)}</strong><small>${esc(locationName(p.location))}${destination === p.location ? ' · Ya está en destino' : ''}</small></div><button class="text-button" type="button" data-remove-pallet="${esc(code)}" aria-label="Quitar ${esc(code)} de la selección">${icon('close')}<span>Quitar</span></button></div>`;
  }).join('');
}
function renderPending(operation) {
  const association = operation.type === 'associate';
  let detail;
  if (association) {
    const p = getPallet(data, operation.pallet);
    detail = `<div class="selection-list">${operation.ofs.map(code => `<div><strong>${esc(code)}</strong><span>${esc(ofName(code))}</span></div>`).join('')}</div><div class="destination"><span>PALLET DESTINO</span><strong>${esc(p.code)}</strong><p>${esc(locationName(p.location))}</p></div><p class="hint">Conserva las asociaciones en otros pallets.</p>`;
  } else {
    const changed = operation.pallets.filter(code => getPallet(data, code).location !== operation.location).length;
    detail = `<div class="section-label">${operation.pallets.length} ${operation.pallets.length === 1 ? 'pallet seleccionado' : 'pallets seleccionados'}</div>${selectedPalletRows(operation.pallets, operation.location)}<div class="destination"><span>UBICACIÓN DE DESTINO</span><strong>${esc(locationName(operation.location))}</strong></div><p class="hint">${changed} ${changed === 1 ? 'pallet cambiará' : 'pallets cambiarán'} de ubicación. Se conserva todo el contenido.</p>`;
  }
  return `<section class="card proposal" aria-labelledby="proposal-title"><span class="eyebrow">PENDIENTE DE CONFIRMAR</span><div class="feature-icon">${icon(association ? 'associate' : 'move')}</div><h2 id="proposal-title">${association ? 'Asociar a pallet' : 'Trasladar pallets'}</h2>${detail}<div class="actions"><button class="button primary" data-action="confirm" type="button">${icon('check')}${association ? 'Confirmar asociación' : 'Confirmar traslado'}</button><button class="button secondary" data-action="cancel" type="button">${icon('close')}Cancelar</button></div></section>`;
}
function renderMove() {
  const codes = context.pallets;
  const available = data.pallets.filter(p => !codes.includes(p.code));
  const selected = codes.length ? `<div class="section-label">${codes.length} ${codes.length === 1 ? 'pallet seleccionado' : 'pallets seleccionados'}</div>${selectedPalletRows(codes)}` : '<p class="record-name">Escanea uno o varios pallets.</p>';
  const destinations = codes.length ? `<div class="section-label">Ubicación de destino</div><p class="hint">Escanea su QR o selecciona una ubicación.</p><div class="location-options">${LOCATIONS.map(loc => {
    const allThere = codes.every(code => getPallet(data, code).location === loc.code);
    return `<button class="item-row" type="button" data-code="${esc(loc.code)}" ${allThere ? 'disabled' : ''}><span><strong>${esc(loc.name)}</strong><small>${esc(loc.code)}</small></span>${allThere ? `<span class="count">${codes.length === 1 ? 'Actual' : 'Todos aquí'}</span>` : `<span class="chevron">${icon('chevron')}</span>`}</button>`;
  }).join('')}</div>` : '';
  return `<section class="card"><div class="feature-heading"><span class="feature-icon">${icon('move')}</span><h2>Seleccionar pallets</h2></div>${selected}${codes.length ? '<p class="hint selection-hint">Puedes escanear más pallets antes de la ubicación.</p>' : ''}${destinations}</section>${available.length ? `<section class="card compact"><div class="section-label">${codes.length ? 'Añadir pallet' : 'O selecciona pallets'}</div>${palletRows(available, true)}</section>` : ''}`;
}
function render() {
  let html = '';
  if (context.pending) html = renderPending(context.pending);
  else if (context.intent === 'move') html = renderMove();
  else if (context.active?.type === 'of') {
    const code = context.active.code;
    html = `<section class="card"><div class="record-head"><span class="record-kind">${icon('order')}<span>ORDEN DE FABRICACIÓN</span></span><button class="text-button" type="button" data-remove="${esc(code)}">${icon('close')}<span>Quitar</span></button></div><h2 class="record-code">${esc(code)}</h2><p class="record-name">${esc(ofName(code))}</p><div class="section-label">Pallets registrados</div>${palletRows(palletsForOF(data, code))}</section>
      <section class="card next-action"><div class="section-label">ASOCIAR A PALLET · ${context.ofs.length} ${context.ofs.length === 1 ? 'OF' : 'OFs'}</div>${context.ofs.length > 1 ? `<div class="of-chips">${context.ofs.map(of => `<button type="button" data-remove="${esc(of)}" aria-label="Quitar ${esc(of)} de la selección">${esc(of)} <span aria-hidden="true">×</span></button>`).join('')}</div>` : ''}<p>Escanea el pallet de destino.</p><span class="hint">Puedes leer más OFs antes del pallet.</span></section>`;
  } else if (context.active?.type === 'pallet') {
    const p = getPallet(data, context.active.code);
    html = `<section class="card"><div class="record-head"><span class="record-kind">${icon('pallet')}<span>PALLET</span></span><button class="text-button" type="button" data-remove-pallet="${esc(p.code)}">${icon('close')}<span>Quitar</span></button></div><h2 class="record-code">${esc(p.code)}</h2><div class="location-line">${icon('location')} ${esc(locationName(p.location))}</div><button class="button primary full" data-action="start-move" type="button">${icon('move')}Mover pallet</button><div class="section-label">Contenido <span class="count">${p.ofs.length} OF</span></div>${p.ofs.length ? p.ofs.map(code => linkRow(code, ofName(code))).join('') : '<p class="empty-line">Pallet vacío</p>'}</section><section class="card next-action"><p>Escanea una OF para asociarla.</p><span class="hint">Escanea más pallets y después una ubicación para moverlos juntos.</span></section>`;
  } else if (context.active?.type === 'location') {
    const loc = context.active.code;
    html = `<section class="card"><span class="record-kind">${icon('location')}<span>UBICACIÓN</span></span><h2>${esc(locationName(loc))}</h2><p class="record-name">${esc(loc)}</p><div class="section-label">Pallets en esta ubicación</div>${palletRows(data.pallets.filter(p => p.location === loc))}</section><section class="card next-action"><p>Escanea un pallet para traerlo aquí.</p></section>`;
  } else {
    html = context.intent === 'associate'
      ? `<section class="card task-ready"><div class="feature-icon">${icon('associate')}</div><h2>Escanea las OFs</h2><p>Después, escanea el pallet.</p></section>`
      : `<p class="workspace-hint">Escanea una etiqueta para ver sus detalles.</p><div class="task-grid"><button class="task-tile" type="button" data-action="start-associate"><span class="task-icon">${icon('associate')}</span><strong>Asociar OFs</strong></button><button class="task-tile" type="button" data-action="start-move"><span class="task-icon">${icon('move')}</span><strong>Mover pallets</strong></button></div><details class="pallet-catalog"><summary>${icon('pallet')}<span>Pallets registrados</span><span class="count">${data.pallets.length}</span></summary><div>${palletRows(data.pallets)}</div></details>`;
  }
  $('main').innerHTML = html;
  $('samples').innerHTML = `<div class="sample-section"><h3>OFs</h3>${OFS.map(of => linkRow(of.code, of.name, '', true)).join('')}</div><div class="sample-section"><h3>Pallets</h3>${palletRows(data.pallets, true)}</div><div class="sample-section"><h3>Ubicaciones</h3>${LOCATIONS.map(l => linkRow(l.code, l.name, '', true)).join('')}</div>`;
  $('screen-title').textContent = context.intent === 'move' || context.pending?.type === 'move' ? 'Mover pallets' : context.pending || context.intent === 'associate' ? 'Asociar OFs' : context.active?.type === 'of' ? 'Orden de fabricación' : context.active?.type === 'pallet' ? 'Detalle del pallet' : context.active?.type === 'location' ? 'Ubicación' : 'Escanear';
  $('go-back').disabled = !navigation.canGoBack;
  $('reader-code').placeholder = context.pending ? 'Confirma o cancela la operación' : context.intent === 'move' ? context.pallets.length ? 'Más pallets o ubicación de destino' : 'Escanea los pallets que quieres mover' : context.ofs.length ? 'Escanea más OFs o un pallet' : context.active?.type === 'pallet' ? 'Escanea otro pallet, OF o ubicación' : 'OF, pallet o ubicación';
  updateStatus();
}
function receive(raw) {
  try {
    const item = identify(raw);
    const now = Date.now();
    if (lastScan === item.code && now - lastAt < 1000) return true;
    const next = scanCode(context, raw, data);
    context = navigation.visit(next); lastScan = item.code; lastAt = now;
    notice(context.pending ? 'Revisa la operación antes de confirmar.' : `${item.code} · Leído`);
    render();
    return true;
  } catch (error) { notice(error.message, true); return false; }
}
const collector = createHidCollector({
  onRead: raw => { receive(raw); focusReader(); },
  isKnown: raw => { try { identify(raw); return true; } catch { return false; } },
  onPartial: value => { $('reader-code').value = value; },
});
const reader = createReader({ video: $('camera'), canvas: $('decode-canvas'),
  onStatus: (text, error) => { $('camera-status').textContent = text; $('camera-status').classList.toggle('error', !!error); },
  onRead: raw => {
    if (receive(raw)) { closeCamera(); return true; }
    $('camera-status').textContent = $('notice').textContent; $('camera-status').classList.add('error'); return false;
  },
});
function closeCamera() { reader.stop(); if ($('scanner').open) $('scanner').close(); focusReader(); }
function clearContext() { context = navigation.home(); lastScan = ''; collector.clear(); notice(); render(); focusReader(); }
function goBack() { context = navigation.back(); lastScan = ''; collector.clear(); notice(); render(); focusReader(); }
$('reader-code').addEventListener('input', event => collector.setValue(event.target.value));
$('reader-code').addEventListener('paste', event => {
  const text = event.clipboardData?.getData('text'); if (text) { event.preventDefault(); collector.setValue(text); }
});
$('scan-form').addEventListener('submit', event => { event.preventDefault(); const value = collector.value || $('reader-code').value; collector.clear(); if (value) receive(value); focusReader(); });
document.addEventListener('keydown', event => {
  if (hasDialog() || event.isComposing) return;
  const target = event.target;
  const editable = target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"]');
  if (editable && target !== $('reader-code')) return;
  if (collector.key(event)) return;
  if (!editable && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault(); collector.setValue(collector.value + event.key);
  } else if (!editable && event.key === 'Backspace' && collector.value) {
    event.preventDefault(); collector.setValue(collector.value.slice(0, -1));
  }
}, true);
$('go-home').onclick = clearContext;
$('go-back').onclick = goBack;
$('open-camera').onclick = () => {
  if (context.pending) { notice('Confirma o cancela la operación pendiente.', true); return; }
  collector.clear(); $('scanner').showModal(); updateStatus(); reader.start();
};
$('close-scanner').onclick = closeCamera;
$('retry-camera').onclick = () => reader.start();
$('scanner').addEventListener('cancel', () => reader.stop());
$('scanner').addEventListener('close', () => { reader.stop(); focusReader(); });
$('open-manual').onclick = () => {
  if (context.pending) { notice('Confirma o cancela la operación pendiente.', true); return; }
  collector.clear(); $('manual-code').value = ''; $('manual-code').setCustomValidity('');
  $('manual-dialog').showModal(); $('manual-code').focus(); updateStatus();
};
$('manual-code').oninput = () => $('manual-code').setCustomValidity('');
$('manual-form').onsubmit = event => {
  event.preventDefault();
  if (receive($('manual-code').value)) { $('manual-dialog').close(); focusReader(); }
  else { $('manual-code').setCustomValidity($('notice').textContent); $('manual-code').reportValidity(); }
};
$('help-button').onclick = () => { collector.clear(); $('help').showModal(); updateStatus(); };
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.dataset.close) { $(button.dataset.close).close(); focusReader(); return; }
  if (button?.dataset.record) {
    const next = scanCode(emptyContext(), button.dataset.record, data);
    context = navigation.visit(next); lastScan = ''; collector.clear(); notice(); render(); focusReader(); return;
  }
  if (button?.dataset.code) { collector.clear(); receive(button.dataset.code); $('sample-data').open = false; focusReader(); return; }
  if (button?.dataset.removePallet) {
    context = navigation.restart(removeSelectedPallet(context, button.dataset.removePallet));
    lastScan = ''; collector.clear(); notice('Pallet quitado de la selección.'); render(); focusReader(); return;
  }
  if (button?.dataset.remove) {
    context = navigation.restart(removeSelectedOF(context, button.dataset.remove));
    lastScan = ''; collector.clear(); notice('Lectura quitada de la selección.'); render(); focusReader(); return;
  }
  if (button?.dataset.action === 'cancel') { goBack(); notice('Operación cancelada.'); return; }
  if (button?.dataset.action === 'start-associate') {
    context = navigation.visit({ ...emptyContext(), intent: 'associate' });
    lastScan = ''; collector.clear(); notice(); render(); focusReader(); return;
  }
  if (button?.dataset.action === 'start-move') {
    context = navigation.visit(beginMove(context));
    lastScan = ''; collector.clear(); notice(); render(); focusReader(); return;
  }
  if (button?.dataset.action === 'confirm') {
    try {
      const result = confirmOperation(context, data);
      const saved = commit(result.data); context = navigation.restart(result.context); lastScan = ''; collector.clear();
      const message = result.operation.type === 'associate' ? `${result.operation.ofs.length} OF asociada${result.operation.ofs.length > 1 ? 's' : ''} a ${result.operation.pallet}.` : `${result.operation.pallets.length} ${result.operation.pallets.length === 1 ? 'pallet en' : 'pallets en'} ${locationName(result.operation.location)}.`;
      notice(saved ? message : `${message} Sólo en esta pestaña: el navegador no permite guardar.`, !saved);
      render(); focusReader();
    } catch (error) { notice(error.message, true); }
    return;
  }
  if (!event.target.closest('button,a,summary,input,textarea,select,label,dialog')) focusReader();
});
$('reset').onclick = () => {
  if (!window.confirm('¿Reiniciar los datos de prueba de este navegador?')) { focusReader(); return; }
  const saved = commit(initialData()); clearContext();
  notice(saved ? 'Datos de prueba reiniciados.' : 'Reiniciado sólo en esta pestaña.', !saved);
};
document.addEventListener('visibilitychange', () => {
  collector.clear(); if (document.hidden) { reader.stop(); if ($('scanner').open) $('scanner').close(); }
  else focusReader(); updateStatus();
});
window.addEventListener('pagehide', () => { collector.clear(); reader.stop(); });
window.addEventListener('pageshow', focusReader);
window.addEventListener('focus', focusReader);
window.addEventListener('blur', () => { collector.clear(); updateStatus(); });
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', focusReader);
render(); focusReader(); if (storageNote) notice(storageNote, true);
