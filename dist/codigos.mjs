import { OFS, LOCATIONS, PALLET_CODES } from './domain.mjs';
function qrSVG(text) {
  const code = globalThis.qrcode(0,'M');code.addData(text);code.make();
  return code.createSvgTag({cellSize:7,margin:28,scalable:true});
}
const groups = [
  ...OFS.map(o=>({code:o.code,title:o.name,kind:'ORDEN DE FABRICACIÓN'})),
  ...PALLET_CODES.map((code,i)=>({code,title:['Inicialmente en Montaje','Inicialmente en Corte','Inicialmente en Control de calidad'][i],kind:'PALLET FÍSICO'})),
  ...LOCATIONS.map(l=>({code:l.code,title:l.name,kind:'UBICACIÓN'})),
];
const grid=document.getElementById('qr-cards');
for(const item of groups) {
  const card=document.createElement('article');card.className='qr-card';
  const kind=document.createElement('span');kind.className='qr-category';kind.textContent=item.kind;
  const image=document.createElement('div');image.className='qr-svg';image.innerHTML=qrSVG(item.code);image.setAttribute('role','img');image.setAttribute('aria-label','QR: '+item.code);
  const code=document.createElement('strong');code.textContent=item.code;
  const title=document.createElement('p');title.textContent=item.title;
  card.append(kind,image,code,title);grid.append(card);
}
const url = new URL('./',location.href).href;
document.getElementById('launch-qr').innerHTML=qrSVG(url);
const launch=document.getElementById('launch-url');launch.href=url;launch.textContent=url;
document.getElementById('print').onclick=()=>window.print();
