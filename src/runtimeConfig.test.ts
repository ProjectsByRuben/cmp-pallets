import { expect, it, vi } from 'vitest';
import { OdooAccessApi } from './api';
import { getRuntimeConfig, resetChangedEnvironment } from './runtimeConfig';

it('authenticates against the database configured at runtime without recompilation', async () => {
  window.CMP_CONFIG = { database: 'second_database', backend: 'https://other-odoo.invalid', appOrigin: 'https://pallets.cmp3.es' };
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('native login')).mockResolvedValueOnce(new Response(JSON.stringify({ result: { uid: 10 } })));
  await new OdooAccessApi(fetcher).login('synthetic-user', 'synthetic-password');
  expect(JSON.parse(fetcher.mock.calls[1][1].body).params.db).toBe('second_database');
});

it('does not send credentials when runtime configuration is absent', async () => {
  delete window.CMP_CONFIG;
  const fetcher = vi.fn();
  await expect(new OdooAccessApi(fetcher).login('synthetic-user', 'synthetic-password')).rejects.toThrow('configuración');
  expect(fetcher).not.toHaveBeenCalled();
});

it('rejects credentials and non-root URLs in public connection configuration', () => {
  window.CMP_CONFIG!.backend = 'https://user:password@other-odoo.invalid';
  expect(getRuntimeConfig).toThrow('configuración');
  window.CMP_CONFIG!.backend = 'https://other-odoo.invalid/anything';
  expect(getRuntimeConfig).toThrow('configuración');
});

it('preserves the current tab on reload but clears old identity and work when Odoo or database changes', () => {
  resetChangedEnvironment();
  sessionStorage.setItem('cmp.pallets.tab.access.v1', 'synthetic identity');
  sessionStorage.setItem('cmp.pallets.tab.work.v1', 'synthetic selection');
  resetChangedEnvironment();
  expect(sessionStorage.getItem('cmp.pallets.tab.work.v1')).toBe('synthetic selection');
  window.CMP_CONFIG!.database = 'other_database';
  resetChangedEnvironment();
  expect(sessionStorage.getItem('cmp.pallets.tab.access.v1')).toBeNull();
  expect(sessionStorage.getItem('cmp.pallets.tab.work.v1')).toBeNull();
  sessionStorage.setItem('cmp.pallets.tab.work.v1', 'another selection');
  window.CMP_CONFIG!.backend = 'https://another-odoo.invalid';
  resetChangedEnvironment();
  expect(sessionStorage.getItem('cmp.pallets.tab.work.v1')).toBeNull();
});
