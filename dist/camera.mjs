export function createReader({ video, canvas, onStatus, onRead, decode = globalThis.jsQR,
  media = globalThis.navigator?.mediaDevices,
  requestFrame = fn => requestAnimationFrame(fn), cancelFrame = id => cancelAnimationFrame(id),
}) {
  let generation = 0, stream = null, frame = null, lastFrame = 0, lastCode = '', lastRead = 0;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  function stop() {
    generation++;
    if (frame !== null) cancelFrame(frame);
    frame = null;
    if (stream) for (const track of stream.getTracks()) track.stop();
    stream = null;
    video.pause();
    video.srcObject = null;
  }
  async function start() {
    stop();
    const session = generation;
    if (!media?.getUserMedia) { onStatus('Abre el enlace HTTPS de la demo en Safari para usar la cámara.', true); return; }
    if (typeof decode !== 'function' || !context) { onStatus('No se ha cargado el lector. Recarga la página y vuelve a intentarlo.', true); return; }
    onStatus('Permite el uso de la cámara cuando Safari te lo pregunte.');
    try {
      const acquired = await media.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (session !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream = acquired;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = acquired;
      await video.play();
      if (session !== generation) return;
      lastFrame = 0; lastCode = ''; lastRead = 0;
      onStatus('Apunta a un único QR. Se leerá automáticamente.');
      const tick = time => {
        if (session !== generation) return;
        if (video.readyState >= 2 && video.videoWidth && time - lastFrame > 170) {
          lastFrame = time;
          // Decode the centre visible in the square viewfinder, not labels off-screen.
          const side = Math.min(video.videoWidth, video.videoHeight) * 0.82;
          const width = Math.round(Math.min(side, 800));
          const height = width;
          if (width && height) {
            canvas.width = width; canvas.height = height;
            try {
              context.drawImage(video, (video.videoWidth-side)/2, (video.videoHeight-side)/2, side, side, 0, 0, width, height);
              const pixels = context.getImageData(0, 0, width, height);
              const result = decode(pixels.data, width, height, { inversionAttempts: 'dontInvert' });
              if (result?.data && (result.data !== lastCode || time - lastRead > 1800)) {
                lastCode = result.data; lastRead = time;
                if (onRead(result.data)) { stop(); return; }
              }
            } catch { onStatus('No se pudo leer ese fotograma. Mantén el QR enfocado o vuelve a abrir la cámara.', true); }
          }
        }
        if (session === generation) frame = requestFrame(tick);
      };
      frame = requestFrame(tick);
    } catch (error) {
      if (session !== generation) return;
      stop();
      const message = error.name === 'NotAllowedError'
        ? 'La cámara no tiene permiso. En los ajustes de este sitio de Safari, permite Cámara y pulsa «Reintentar».'
        : error.name === 'NotFoundError'
          ? 'No se encuentra una cámara. Puedes introducir el código a mano.'
          : 'No se pudo abrir la cámara. Cierra otras aplicaciones que la usen y pulsa «Reintentar».';
      onStatus(message, true);
    }
  }
  return { start, stop };
}
