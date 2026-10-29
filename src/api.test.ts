import { describe, expect, it, vi } from 'vitest';
import { ApiError, OdooAccessApi } from './api';

const bootstrap = {
  user: { id: 10, name: 'Cuenta de prueba' }, requires_pin: true, employees: [], csrf_token: 'synthetic-csrf',
};
const ok = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { headers: { 'Content-Type': 'application/json' } });

describe('Odoo identity API contract', () => {
  it('posts QR text and profile credentials in the protected lookup body', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ ok: false, error: 'QR no encontrado' }));
    const api = new OdooAccessApi(fetcher);
    await api.lookup('synthetic-token', 'OF99-00001', 50);
    const [path, request] = fetcher.mock.calls[0];
    expect(path).toBe('/api/cmp_pallets/lookup');
    expect(JSON.parse(request.body).params).toEqual({ token: 'synthetic-token', code: 'OF99-00001', offset: 50, csrf_token: '' });
    expect(path).not.toContain('synthetic-token');
  });
  it('sends session cookies and CSRF only through same-origin JSON POSTs', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('<html>native login</html>')).mockResolvedValueOnce(ok(bootstrap)).mockResolvedValueOnce(ok({ ok: false, error: 'PIN incorrecto' }));
    const api = new OdooAccessApi(fetcher);
    await api.bootstrap();
    await api.unlock(20, '4826');
    expect(fetcher.mock.calls[0][0]).toBe('/api/session/prepare');
    const [path, request] = fetcher.mock.calls[2];
    expect(path).toBe('/api/cmp_pallets/access/unlock');
    expect(request).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    expect(JSON.parse(request.body).params).toEqual({ employee_id: 20, pin: '4826', csrf_token: 'synthetic-csrf' });
    expect(path).not.toContain('4826');
  });

  it('never retries failed PIN verification requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ ok: false, error: 'Espera cinco minutos' }));
    const api = new OdooAccessApi(fetcher);
    expect(await api.unlock(20, '0000')).toEqual({ ok: false, error: 'Espera cinco minutos' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('distinguishes an expired Odoo session from connectivity errors', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('<html>native login</html>')).mockResolvedValueOnce(new Response(JSON.stringify({ error: { data: { name: 'odoo.http.SessionExpiredException' } } })))
      .mockRejectedValueOnce(new TypeError('offline'));
    const api = new OdooAccessApi(fetcher);
    await expect(api.bootstrap()).rejects.toMatchObject({ kind: 'session' });
    await expect(api.bootstrap()).rejects.toMatchObject({ kind: 'network' });
  });

  it('does not expose Odoo tracebacks or technical exception messages', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('<html>native login</html>')).mockResolvedValue(new Response(JSON.stringify({ error: { data: {
      name: 'builtins.RuntimeError', message: 'internal confidential detail', debug: 'traceback details',
    } } })));
    await expect(new OdooAccessApi(fetcher).bootstrap()).rejects.toEqual(new ApiError('No se ha podido completar el acceso.', 'access'));
  });

  it('rejects a profile that is not an authorized operator or administrator', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ employee_id: 20, name: 'Denied', role: 'none' }));
    await expect(new OdooAccessApi(fetcher).profile('synthetic-token')).rejects.toMatchObject({ kind: 'access' });
  });

  it('rejects HTML or malformed responses without treating them as authenticated', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('<html>native login</html>')).mockResolvedValueOnce(new Response('<html>proxy unavailable</html>'))
      .mockResolvedValueOnce(ok(null));
    const api = new OdooAccessApi(fetcher);
    await expect(api.bootstrap()).rejects.toMatchObject({ kind: 'network' });
    await expect(api.bootstrap()).rejects.toMatchObject({ kind: 'access' });
  });
});


it('sends an explicit operation with CSRF and leaves the idempotency key unchanged', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('login')).mockResolvedValueOnce(ok(bootstrap))
    .mockResolvedValue(ok({ ok: true, pallet_code: 'P209900001', added: 1 }));
  const api = new OdooAccessApi(fetcher);
  await api.bootstrap();
  const proposal = { request_id: 'synthetic-request', pallet_id: 1, pallet_revision: 'a'.repeat(64), productions: [{ id: 2, revision: 'b'.repeat(64) }] };
  await api.associate('synthetic-token', proposal);
  expect(fetcher.mock.calls[2][0]).toBe('/api/cmp_pallets/associate');
  expect(JSON.parse(fetcher.mock.calls[2][1].body).params).toEqual({ ...proposal, token: 'synthetic-token', csrf_token: 'synthetic-csrf' });
});


it('posts a group movement with the same-origin profile and request identity', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('login')).mockResolvedValueOnce(ok(bootstrap))
    .mockResolvedValue(ok({ ok: true, moved: 1, unchanged: 1, location_code: 'SYNTHETIC' }));
  const api = new OdooAccessApi(fetcher); await api.bootstrap();
  const proposal = { request_id: 'synthetic-move', location_id: 3, pallets: [{ id: 1, revision: 'a'.repeat(64) }, { id: 2, revision: 'b'.repeat(64) }] };
  expect(await api.move('synthetic-token', proposal)).toMatchObject({ moved: 1, unchanged: 1 });
  expect(fetcher.mock.calls[2][0]).toBe('/api/cmp_pallets/move');
  expect(JSON.parse(fetcher.mock.calls[2][1].body).params).toEqual({ ...proposal, token: 'synthetic-token', csrf_token: 'synthetic-csrf' });
});

it('treats malformed movement results as an unknown outcome eligible for identical retry', async () => {
  const fetcher = vi.fn().mockResolvedValue(ok({ ok: true, moved: 'yes', location_code: 'SYNTHETIC' }));
  await expect(new OdooAccessApi(fetcher).move('synthetic-token', { request_id: 'test', location_id: 1, pallets: [] })).rejects.toMatchObject({ kind: 'network' });
});
