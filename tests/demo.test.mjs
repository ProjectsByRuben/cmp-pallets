import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { OFS, LOCATIONS, PALLET_CODES, initialData, validateData, identify, getPallet, palletsForOF, addToPallet, movePallet } from '../dist/domain.mjs';
import { createReader } from '../dist/camera.mjs';

const require=createRequire(import.meta.url);
const qrcode=require('../dist/vendor/qrcode.js');
const jsQR=require('../dist/vendor/jsqr.js');

function raster(text, rotated=false) {
  const qr=qrcode(0,'M');qr.addData(text);qr.make();
  const cells=qr.getModuleCount(), scale=7, margin=4;
  const size=(cells+margin*2)*scale;
  const pixels=new Uint8ClampedArray(size*size*4);pixels.fill(255);
  for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)if(qr.isDark(y,x)) {
    for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++) {
      let px=(x+margin)*scale+sx,py=(y+margin)*scale+sy;
      if(rotated)[px,py]=[size-1-py,px];
      const i=(py*size+px)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;
    }
  }
  return {pixels,size};
}

test('El lector decodifica todos los QR reales de la hoja, también girados',()=>{
  const codes=[...OFS.map(o=>o.code),...PALLET_CODES,...LOCATIONS.map(l=>l.code),'https://cmp-pallets-iphone-demo.cmp-grupo-7773.chatgpt.site/'];
  for(const text of codes)for(const rotated of [false,true]) {
    const {pixels,size}=raster(text,rotated);
    assert.equal(jsQR(pixels,size,size,{inversionAttempts:'dontInvert'})?.data,text);
  }
});

test('Una agrupación conserva los otros pallets de la OF y no duplica contenido',()=>{
  const original=initialData();
  const next=addToPallet(original,['OF-101','OF/26/0042','OF/26/0042'],'P202600003');
  assert.equal(palletsForOF(next,'OF-101').length,3);
  assert.deepEqual(getPallet(next,'P202600003').ofs,['OF-101','OF/26/0042']);
  assert.deepEqual(original,initialData());
  const repeated=addToPallet(next,['OF-101','OF/26/0042'],'P202600003');
  assert.deepEqual(getPallet(repeated,'P202600003').ofs,getPallet(next,'P202600003').ofs);
  assert.equal(validateData(repeated),true);
});

test('Reubicar un pallet actualiza las OFs que contiene y conserva las otras ubicaciones',()=>{
  const grouped=addToPallet(initialData(),['OF/26/0042'],'P202600001');
  const moved=movePallet(grouped,'P202600001','LOC-CALIDAD');
  assert.equal(getPallet(moved,'P202600001').location,'LOC-CALIDAD');
  assert.deepEqual(palletsForOF(moved,'OF-101').map(p=>p.location),['LOC-CALIDAD','LOC-CORTE']);
  assert.equal(palletsForOF(moved,'OF/26/0042')[0].location,'LOC-CALIDAD');
  assert.equal(getPallet(grouped,'P202600001').location,'LOC-MONTAJE');
});

test('Código desconocido, producto real o URL no se aceptan como una etiqueta de la demo',()=>{
  for(const value of ['OF-NO-EXISTE','https://example.com/','PALLET:P202600001','KIT-REAL-001',''])assert.throws(()=>identify(value));
  assert.deepEqual(identify('  of/26/0042\n'),{type:'of',code:'OF/26/0042'});
  assert.deepEqual(identify('loc-calidad'),{type:'location',code:'LOC-CALIDAD'});
  assert.throws(()=>addToPallet(initialData(),[],'P202600001'));
  assert.throws(()=>addToPallet(initialData(),['OT-001'],'P202600001'));
  assert.throws(()=>movePallet(initialData(),'P202600001','DESCONOCIDA'));
});

test('La carga de datos rechaza estados incompletos o manipulados y conserva un historial acotado',()=>{
  assert.equal(validateData(null),false);assert.equal(validateData(initialData()),true);
  const bad=initialData();bad.pallets[0].ofs.push('NO-EXISTE');assert.equal(validateData(bad),false);
  const duplicate=initialData();duplicate.pallets[2].code='P202600001';assert.equal(validateData(duplicate),false);
  let state=initialData();
  for(let i=0;i<40;i++)state=movePallet(state,'P202600001',i%2?'LOC-CORTE':'LOC-CALIDAD');
  assert.equal(state.history.length,30);assert.equal(validateData(state),true);
});

function cameraFixture(media,decode=()=>null,onRead=()=>false) {
  let stopped=0,paused=0;
  const statuses=[],callbacks=new Map();let id=0;
  const stream={getTracks:()=>[{stop:()=>{stopped++;}}]};
  const video={readyState:2,videoWidth:100,videoHeight:100,srcObject:null,play:async()=>{},pause:()=>{paused++;}};
  const canvas={getContext:()=>({drawImage:()=>{},getImageData:()=>({data:new Uint8ClampedArray(40000)})})};
  const reader=createReader({video,canvas,decode,onRead,onStatus:(text,error)=>statuses.push({text,error}),media:media||{getUserMedia:async()=>stream},requestFrame:fn=>{callbacks.set(++id,fn);return id;},cancelFrame:key=>callbacks.delete(key)});
  return {reader,video,statuses,callbacks,stream,get stopped(){return stopped;},get paused(){return paused;}};
}

test('Cerrar el lector antes de conceder permiso detiene la cámara que llegue tarde',async()=>{
  let resolveMedia;
  const f=cameraFixture({getUserMedia:()=>new Promise(resolve=>{resolveMedia=resolve;})});
  const start=f.reader.start();f.reader.stop();resolveMedia(f.stream);await start;
  assert.equal(f.stopped,1);assert.equal(f.video.srcObject,null);assert.equal(f.callbacks.size,0);
});

test('Una lectura aceptada detiene las pistas y el bucle de cámara',async()=>{
  const reads=[];
  const f=cameraFixture(null,()=>({data:'OF/26/0042'}),code=>{reads.push(code);return true;});
  await f.reader.start();assert.equal(f.video.playsInline,true);assert.equal(f.video.muted,true);
  const [id,callback]=[...f.callbacks.entries()][0];f.callbacks.delete(id);callback(200);
  assert.deepEqual(reads,['OF/26/0042']);assert.equal(f.stopped,1);assert.equal(f.video.srcObject,null);assert.equal(f.callbacks.size,0);
});

test('La denegación de permiso ofrece una salida sin dejar recursos abiertos',async()=>{
  const f=cameraFixture({getUserMedia:async()=>{throw Object.assign(new Error('Denied'),{name:'NotAllowedError'});}});
  await f.reader.start();assert.match(f.statuses.at(-1).text,/permiso/);assert.equal(f.statuses.at(-1).error,true);assert.equal(f.video.srcObject,null);assert.equal(f.callbacks.size,0);
});

test('Detener una cámara activa limpia las pistas y permite abrirla otra vez',async()=>{
  const f=cameraFixture();await f.reader.start();f.reader.stop();assert.equal(f.stopped,1);assert.equal(f.callbacks.size,0);
  await f.reader.start();assert.equal(f.callbacks.size,1);f.reader.stop();assert.equal(f.stopped,2);assert.equal(f.video.srcObject,null);
});
