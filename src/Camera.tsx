import { useEffect, useRef, useState } from 'react';
import { createReader } from '../dist/camera.mjs';
import decoderUrl from '../dist/vendor/jsqr.js?url';
import { modalKeys } from './modal';

let decoder: Promise<void> | undefined;
function loadDecoder() {
  if (!decoder) decoder = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = decoderUrl;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); decoder = undefined; reject(new Error('decoder unavailable')); };
    document.head.append(script);
  });
  return decoder;
}

export function Camera({ onRead, onClose }: { onRead(code: string): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Abriendo cámara…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const reader = createReader({
      video: video.current!, canvas: canvas.current!, onStatus: setStatus,
      onRead(code) { onRead(code); return true; },
    });
    let cancelled = false;
    void loadDecoder().then(() => { if (!cancelled) return reader.start(); })
      .catch(() => setStatus('No se pudo abrir el lector. Vuelve a intentarlo.'));
    const hide = () => { if (document.hidden) { reader.stop(); onClose(); } };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelled = true; reader.stop(); document.removeEventListener('visibilitychange', hide); };
  }, [attempt]);
  return <div className="modal-backdrop" onKeyDown={event => modalKeys(event, onClose)}>
    <section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="modal-heading"><h2 id="camera-title">Leer QR</h2><button className="icon-action" onClick={onClose} autoFocus aria-label="Cerrar cámara">×</button></div>
      <video ref={video} autoPlay muted playsInline aria-label="Cámara de lectura"/>
      <canvas ref={canvas} hidden/>
      <p role="status">{status.replace('Abre el enlace HTTPS de la demo en Safari para usar la cámara.', 'La cámara necesita una conexión HTTPS. Puedes usar el lector o introducir el código.')}</p>
      <button className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
    </section>
  </div>;
}
