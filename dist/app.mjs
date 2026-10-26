import { OFS, LOCATIONS, STORAGE_KEY, initialData, validateData, identify, ofName, locationName, getPallet, palletsForOF, addToPallet, movePallet } from './domain.mjs';
import { createReader } from './camera.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cameraIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5l2-2h4l2 2h4a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"/><circle cx="12" cy="12" r="4"/></svg>';
let data = initialData();
let storageNote = '';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const candidate = JSON.parse(saved);
    if (validateData(candidate)) data = candidate;
    else storageNote = 'Los datos anteriores no eran válidos. Se ha abierto una prueba nueva.';
  }
} catch { storageNote = 'Este navegador no permite guardar datos. La prueba funcionará mientras mantengas la página abierta.'; }
const ui = { view:'group', step:1, ofs:[], pallet:null, result:null, lookup:null, movePallet:null, moveLocation:null, moved:false };
let reading = null;
function notice(text = '', error = false) {
  $('notice').textContent = text;
  $('notice').hidden = !text;
  $('notice').classList.toggle('error', error);
}
function commit(next) {
  if (!validateData(next)) throw new Error('No se pudo validar esta operación de prueba.');
  data = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}
const button = (text, action, cls='primary', disabled=false, camera=false) => '<button type="button" class="button full '+cls+'" data-action="'+action+'" '+(disabled?'disabled':'')+'>'+(camera?cameraIcon:'')+text+'</button>';
const stepper = step => '<div class="stepper" aria-label="Paso '+step+' de 3">'+[1,2,3].map(n=>'<span class="'+(n<=step?'done':'')+'"></span>').join('')+'</div><span class="eyebrow">PASO '+step+' DE 3</span>';
const ofRows = (codes, removable=false) => codes.map(code=>'<div class="row"><div><strong>'+esc(code)+'</strong><small>'+esc(ofName(code))+'</small></div>'+(removable?'<button type="button" class="remove" data-remove="'+esc(code)+'" aria-label="Quitar '+esc(code)+'">×</button>':'<span class="pill">OF</span>')+'</div>').join('');
const target = p => '<div class="target"><span class="muted-label">Pallet de destino</span><strong>'+p.code+'</strong><p>'+locationName(p.location)+'</p></div>';
const guidance = '<div class="scan-help"><strong>¿Dónde están los QR?</strong><p>Abre «Códigos de prueba» en el ordenador o imprime esa hoja. Escanéalos desde esta página con el iPhone.</p></div>';
function renderGroup() {
  if (ui.result) {
    const p = getPallet(data, ui.result.pallet);
    return '<h1 id="page-title" tabindex="-1">Agrupación terminada</h1><p class="subtitle">Este es el cambio que acabas de confirmar.</p><section class="card success-card"><div class="success-icon" aria-hidden="true">✓</div><h2>'+ (ui.result.persisted?'Guardado en este iPhone':'Cambio aplicado en esta pestaña')+'</h2><div class="prepared">'+ofRows(ui.result.ofs)+'</div><div class="arrow" aria-hidden="true">↓</div>'+target(p)+'<p class="hint">Las OFs también conservan sus otros pallets. No se registran cantidades.</p>'+button('Ver contenido del pallet','result-pallet')+button('Empezar otra agrupación','new-group','secondary')+'</section>';
  }
  if (ui.step === 1) return stepper(1)+'<h1 id="page-title" tabindex="-1">Escanea las OFs</h1><p class="subtitle">Primero lee las etiquetas del material que quieres agrupar.</p><section class="card"><h2>'+ (ui.ofs.length?'OFs preparadas':'Empieza con una OF')+'</h2><p class="description">'+(ui.ofs.length?'Todavía no se han añadido a ningún pallet.':'Para la primera prueba, usa la etiqueta OF/26/0042.')+'</p>'+(ui.ofs.length?'<div class="prepared">'+ofRows(ui.ofs,true)+'</div>'+button('Continuar · escanear pallet','next-pallet')+button('Escanear otra OF','scan-of','secondary',false,true):button('Abrir cámara · escanear OF','scan-of','primary',false,true))+guidance+'</section>';
  if (ui.step === 2) return stepper(2)+'<h1 id="page-title" tabindex="-1">Escanea el pallet</h1><p class="subtitle">¿En qué pallet vas a dejar estas OFs?</p><section class="card"><span class="muted-label">Material preparado · '+ui.ofs.length+' OF'+(ui.ofs.length===1?'':'s')+'</span><div class="prepared">'+ofRows(ui.ofs)+'</div>'+button('Abrir cámara · escanear pallet','scan-pallet','primary',false,true)+button('Volver a las OFs','back-ofs','secondary')+'<p class="hint" style="margin-top:16px">En la primera prueba, escanea P202600001. Su ubicación inicial es Montaje.</p></section>';
  const p = getPallet(data, ui.pallet);
  return stepper(3)+'<h1 id="page-title" tabindex="-1">Revisa y confirma</h1><p class="subtitle">Esto es lo que se añadirá. Aún no hay cambios.</p><section class="card"><span class="muted-label">OFs que vas a añadir</span><div class="prepared">'+ofRows(ui.ofs)+'</div><div class="arrow" aria-hidden="true">↓</div>'+target(p)+'<p class="hint" style="margin-bottom:20px">Se conservan el contenido del pallet y las asociaciones con otros pallets.</p>'+button('Confirmar agrupación','confirm-group')+button('Elegir otro pallet','back-pallet','secondary')+'</section>';
}
function palletCard(p) {
  return '<button type="button" class="item-button" data-pallet="'+p.code+'"><span><strong>'+p.code+'</strong><small>'+locationName(p.location)+' · '+p.ofs.length+' OF'+(p.ofs.length===1?'':'s')+'</small></span><span class="chevron" aria-hidden="true">›</span></button>';
}
function renderLookup() {
  if (!ui.lookup) return '<span class="eyebrow">CONSULTAR · NO CAMBIA DATOS</span><h1 id="page-title" tabindex="-1">Encuentra el material</h1><p class="subtitle">Escanea una OF para ver dónde está, o un pallet para ver su contenido.</p><section class="card">'+button('Escanear OF o pallet','scan-lookup','primary',false,true)+guidance+'</section><section class="card"><h2>También puedes elegir</h2><div class="links-list">'+OFS.map(o=>'<button type="button" class="item-button" data-lookup-of="'+esc(o.code)+'"><span><strong>'+esc(o.code)+'</strong><small>'+esc(o.name)+'</small></span><span class="chevron" aria-hidden="true">›</span></button>').join('')+'</div></section>';
  if (ui.lookup.type === 'of') {
    const code = ui.lookup.code;
    const pallets = palletsForOF(data, code);
    return '<span class="eyebrow">CONSULTA DE OF</span><h1 id="page-title" tabindex="-1">'+esc(code)+'</h1><p class="subtitle">'+esc(ofName(code))+'</p><section class="card"><h2>'+ (pallets.length?'Está en '+pallets.length+' pallet'+(pallets.length===1?'':'s'):'Sin pallet registrado')+'</h2><p class="description">'+(pallets.length?'Cada tarjeta indica su ubicación actual.':'Agrupa esta OF con un pallet para poder localizarla.')+'</p><div class="links-list">'+pallets.map(palletCard).join('')+'</div></section>'+button('Consultar otro código','clear-lookup','secondary',false,true);
  }
  const p = getPallet(data, ui.lookup.code);
  return '<span class="eyebrow">CONSULTA DE PALLET</span><h1 id="page-title" tabindex="-1">'+p.code+'</h1><p class="subtitle">Ubicación actual: <strong>'+locationName(p.location)+'</strong></p><section class="card"><h2>Contenido actual</h2>'+ (p.ofs.length?ofRows(p.ofs):'<p class="empty">Este pallet está vacío.</p>')+'<div style="margin-top:20px">'+button('Mover este pallet','move-current')+'</div></section>'+button('Consultar otro código','clear-lookup','secondary',false,true);
}
function renderMove() {
  if (ui.moved) {
    const p = getPallet(data, ui.movePallet);
    return '<h1 id="page-title" tabindex="-1">Pallet reubicado</h1><section class="card success-card"><div class="success-icon" aria-hidden="true">✓</div><h2>'+p.code+'</h2><div class="target"><span class="muted-label">Ahora está en</span><strong>'+locationName(p.location)+'</strong></div><p class="description">Las '+p.ofs.length+' OFs de su contenido se localizan ahora aquí. Sus otros pallets conservan su ubicación.</p>'+button('Ver contenido y ubicación','moved-pallet')+button('Mover otro pallet','new-move','secondary')+'</section>';
  }
  if (!ui.movePallet) return '<span class="eyebrow">MOVER PALLET · PASO 1 DE 2</span><h1 id="page-title" tabindex="-1">¿Qué pallet vas a mover?</h1><p class="subtitle">Se moverá el pallet completo con todas las OFs que contiene.</p><section class="card">'+button('Escanear pallet','scan-move-pallet','primary',false,true)+guidance+'</section>';
  const p = getPallet(data, ui.movePallet);
  return '<span class="eyebrow">MOVER PALLET · PASO 2 DE 2</span><h1 id="page-title" tabindex="-1">Escanea la nueva ubicación</h1><p class="subtitle">'+p.code+' está en '+locationName(p.location)+'.</p><section class="card"><span class="muted-label">Pallet seleccionado</span><div class="target"><strong>'+p.code+'</strong><p>'+p.ofs.length+' OFs · '+locationName(p.location)+'</p></div>'+ (ui.moveLocation?'<div class="arrow" aria-hidden="true">↓</div><div class="target"><span class="muted-label">Nueva ubicación</span><strong>'+locationName(ui.moveLocation)+'</strong><p>'+ui.moveLocation+'</p></div><p class="hint" style="margin-bottom:18px">Se actualizará la ubicación de todo el contenido de este pallet.</p>'+button('Confirmar nueva ubicación','confirm-move')+button('Escanear otra ubicación','scan-location','secondary',false,true):button('Escanear QR de ubicación','scan-location','primary',false,true))+'<p class="hint" style="margin-top:16px">Prueba con LOC-CALIDAD: Control de calidad.</p></section>';
}
function render(focus = false) {
  for (const b of document.querySelectorAll('[data-route]')) {
    if (b.dataset.route === ui.view) b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  }
  $('main').innerHTML = ui.view==='group'?renderGroup():ui.view==='lookup'?renderLookup():renderMove();
  if (focus) $('page-title')?.focus({preventScroll:true});
}
function setView(view) {
  if (ui.view==='group' && !ui.result && ui.ofs.length && view!=='group' && !window.confirm('Hay OFs preparadas sin confirmar. ¿Salir y descartar estas lecturas?')) return;
  if (view!=='group') { ui.ofs=[];ui.pallet=null;ui.step=1;ui.result=null; }
  ui.view=view;notice();render(true);
}
const descriptions = {
  'group-of': ['OF DE PRUEBA','Escanea una OF','of'],
  'group-pallet': ['PALLET DE DESTINO','Escanea el pallet','pallet'],
  'lookup': ['SÓLO CONSULTA','Escanea OF o pallet','lookup'],
  'move-pallet': ['PALLET A MOVER','Escanea el pallet','pallet'],
  'move-location': ['NUEVA UBICACIÓN','Escanea la ubicación','location'],
};
function readCode(raw) {
  if (!reading) return false;
  let item;
  try { item=identify(raw); } catch(error) { cameraStatus(error.message,true);return false; }
  const expect=descriptions[reading][2];
  if (expect==='lookup' ? item.type==='location' : item.type!==expect) {
    cameraStatus(item.type==='of'?'Has leído una OF. Ahora necesitamos la etiqueta del pallet.':item.type==='pallet'?'Has leído un pallet. Escanea el tipo de etiqueta indicado arriba.':'Has leído una ubicación. Escanea el tipo de etiqueta indicado arriba.',true);
    return false;
  }
  if (reading==='group-of' && ui.ofs.includes(item.code)) { cameraStatus('Esta OF ya está preparada. Escanea otra etiqueta o cierra la cámara.',true);return false; }
  if (reading==='move-location' && getPallet(data,ui.movePallet).location===item.code) { cameraStatus('Ese pallet ya está en esa ubicación. Escanea una zona diferente.',true);return false; }
  const mode=reading;
  closeScanner();
  notice();
  if (mode==='group-of') {ui.ofs.push(item.code);ui.step=1;}
  else if (mode==='group-pallet') {ui.pallet=item.code;ui.step=3;}
  else if (mode==='lookup') ui.lookup=item;
  else if (mode==='move-pallet') {ui.movePallet=item.code;ui.moveLocation=null;ui.moved=false;}
  else if (mode==='move-location') ui.moveLocation=item.code;
  render(true);
  return true;
}
function cameraStatus(text,error=false) { $('camera-status').textContent=text;$('camera-status').classList.toggle('error',error); }
const reader=createReader({video:$('camera'),canvas:$('decode-canvas'),onStatus:cameraStatus,onRead:readCode});
function closeScanner() { reader.stop();reading=null;if($('scanner').open)$('scanner').close(); }
async function openScanner(mode) {
  closeScanner();reading=mode;
  const [label,title]=descriptions[mode];
  $('scanner-type').textContent=label;$('scanner-title').textContent=title;$('manual-code').value='';
  $('manual-code').placeholder=mode==='group-of'?'OF/26/0042':mode==='move-location'?'LOC-CALIDAD':'P202600001';
  $('scanner').showModal();
  if (globalThis.isSecureContext===false) {cameraStatus('Abre el enlace HTTPS de la demo en Safari. Un archivo o una dirección HTTP no permiten usar la cámara.',true);return;}
  await reader.start();
}
$('close-scanner').onclick=closeScanner;
$('scanner').addEventListener('cancel',event=>{event.preventDefault();closeScanner();});
$('retry-camera').onclick=()=>reader.start();
$('manual-form').onsubmit=event=>{event.preventDefault();readCode($('manual-code').value);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)closeScanner();});
window.addEventListener('pagehide',()=>reader.stop());
document.addEventListener('click',event=>{
  const element=event.target.closest('button');if(!element)return;
  try {
    if(element.dataset.route) {setView(element.dataset.route);return;}
    if(element.dataset.remove) {ui.ofs=ui.ofs.filter(code=>code!==element.dataset.remove);render();return;}
    if(element.dataset.pallet) {ui.lookup={type:'pallet',code:element.dataset.pallet};ui.view='lookup';notice();render(true);return;}
    if(element.dataset.lookupOf) {ui.lookup={type:'of',code:element.dataset.lookupOf};render(true);return;}
    switch(element.dataset.action) {
      case 'scan-of':openScanner('group-of');return;
      case 'next-pallet':if(!ui.ofs.length)return;ui.step=2;break;
      case 'scan-pallet':openScanner('group-pallet');return;
      case 'back-ofs':ui.step=1;break;
      case 'back-pallet':ui.step=2;ui.pallet=null;break;
      case 'confirm-group':{
        if(!ui.ofs.length||!ui.pallet)return;
        const persisted=commit(addToPallet(data,ui.ofs,ui.pallet));
        ui.result={pallet:ui.pallet,ofs:[...ui.ofs],persisted};
        if(!persisted)notice('El navegador no permite guardar. Los cambios sólo durarán mientras esté abierta esta página.',true);
        break;
      }
      case 'result-pallet':ui.lookup={type:'pallet',code:ui.result.pallet};ui.view='lookup';ui.ofs=[];ui.result=null;break;
      case 'new-group':ui.step=1;ui.ofs=[];ui.pallet=null;ui.result=null;notice();break;
      case 'scan-lookup':openScanner('lookup');return;
      case 'clear-lookup':ui.lookup=null;render();openScanner('lookup');return;
      case 'move-current':ui.movePallet=ui.lookup.code;ui.moveLocation=null;ui.moved=false;ui.view='move';break;
      case 'scan-move-pallet':openScanner('move-pallet');return;
      case 'scan-location':openScanner('move-location');return;
      case 'confirm-move':{
        if(!ui.movePallet||!ui.moveLocation)return;
        const persisted=commit(movePallet(data,ui.movePallet,ui.moveLocation));ui.moved=true;
        if(!persisted)notice('El cambio sólo está en esta pestaña: el navegador no permite guardarlo.',true);
        break;
      }
      case 'moved-pallet':ui.lookup={type:'pallet',code:ui.movePallet};ui.view='lookup';break;
      case 'new-move':ui.movePallet=null;ui.moveLocation=null;ui.moved=false;notice();break;
      default:return;
    }
    render(true);
  } catch(error) {notice(error.message,true);}
});
$('reset').onclick=()=>{
  if(!window.confirm('¿Volver a los datos iniciales de esta prueba? Se borrarán sólo los cambios de esta demo en este navegador.'))return;
  closeScanner();const persisted=commit(initialData());
  Object.assign(ui,{view:'group',step:1,ofs:[],pallet:null,result:null,lookup:null,movePallet:null,moveLocation:null,moved:false});
  notice(persisted?'Prueba reiniciada. Empieza con OF/26/0042.':'Reiniciada en esta pestaña. El navegador no permite guardar.',!persisted);render(true);
};
render();
if(storageNote)notice(storageNote);
