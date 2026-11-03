import { clearTab } from './tabState';

export type RuntimeConfig = { database: string; backend: string; appOrigin: string };
declare global { interface Window { CMP_CONFIG?: RuntimeConfig } }

export function getRuntimeConfig(): RuntimeConfig {
  const value = window.CMP_CONFIG;
  if (!value || typeof value.database !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value.database)) {
    throw new Error('No se ha podido cargar la configuración de conexión. Recarga la aplicación.');
  }
  for (const address of [value.backend, value.appOrigin]) {
    let url: URL;
    try { url = new URL(address); } catch { throw new Error('La configuración de conexión no es válida.'); }
    const development = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((!development && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('La configuración de conexión no es válida.');
    }
  }
  return value;
}

export function resetChangedEnvironment() {
  try {
    const config = getRuntimeConfig();
    const key = 'cmp.pallets.tab.environment.v1';
    const identity = JSON.stringify([config.backend, config.database]);
    const previous = sessionStorage.getItem(key);
    if (previous && previous !== identity) clearTab();
    sessionStorage.setItem(key, identity);
  } catch { /* Access bootstrap reports missing configuration; storage is optional. */ }
}
