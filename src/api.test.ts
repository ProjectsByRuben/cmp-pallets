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
    .mockResolvedValue(ok({ ok: true, pallet_code: 'P26-00001', added: 1 }));
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

it('protects creation and label requests and rejects a label for a different identity', async () => {
  const label = { ok: true, pallet_id: 4, code: 'P26-00004', qr_payload: 'CMP:PALLET:P26-00004', png_base64: 'iVBORw0KGgo=' };
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('login')).mockResolvedValueOnce(ok(bootstrap))
    .mockResolvedValueOnce(ok({ ok: true, pallet_id: 4, pallet_code: 'P26-00004' }))
    .mockResolvedValueOnce(ok(label)).mockResolvedValueOnce(ok({ ...label, qr_payload: 'CMP:PALLET:P26-00099' }));
  const api = new OdooAccessApi(fetcher); await api.bootstrap();
  const proposal = { request_id: 'synthetic-create', location_id: 3 };
  await expect(api.createPallet('synthetic-token', proposal)).resolves.toMatchObject({ pallet_id: 4 });
  expect(fetcher.mock.calls[2][0]).toBe('/api/cmp_pallets/create');
  expect(JSON.parse(fetcher.mock.calls[2][1].body).params).toEqual({ ...proposal, token: 'synthetic-token', csrf_token: 'synthetic-csrf' });
  await expect(api.label('synthetic-token', 4)).resolves.toEqual(label);
  expect(fetcher.mock.calls[3][0]).toBe('/api/cmp_pallets/label');
  await expect(api.label('synthetic-token', 4)).rejects.toMatchObject({ kind: 'network' });
});

it('treats an invalid creation response as unknown outcome, keeping its request identity', async () => {
  const fetcher = vi.fn().mockResolvedValue(ok({ ok: true, pallet_id: 4, pallet_code: null }));
  await expect(new OdooAccessApi(fetcher).createPallet('synthetic-token', { request_id: 'synthetic-create' })).rejects.toMatchObject({ kind: 'network' });
  expect(fetcher).toHaveBeenCalledOnce();
});

it('requests the protected location catalog with CSRF and pagination', async () => {
  const page = { ok: true, items: [{ id: 3, code: 'TEST-CORTE', name: 'Corte' }], next_offset: 20 };
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('login')).mockResolvedValueOnce(ok(bootstrap)).mockResolvedValueOnce(ok(page)).mockResolvedValueOnce(ok({ ok: true, items: null }));
  const api = new OdooAccessApi(fetcher); await api.bootstrap();
  await expect(api.locations('synthetic-token', 'CORTE', 0)).resolves.toEqual(page);
  expect(fetcher.mock.calls[2][0]).toBe('/api/cmp_pallets/locations');
  expect(JSON.parse(fetcher.mock.calls[2][1].body).params).toEqual({ token: 'synthetic-token', query: 'CORTE', offset: 0, csrf_token: 'synthetic-csrf' });
  await expect(api.locations('synthetic-token')).rejects.toMatchObject({ kind: 'network' });
});


it('accepts native Odoo void logout and prepares a fresh session with fresh CSRF afterwards', async () => {
  const response = () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1 }));
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('login')).mockResolvedValueOnce(ok(bootstrap))
    .mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response('new login'))
    .mockResolvedValueOnce(ok({ ...bootstrap, csrf_token: 'new-synthetic-csrf' }))
    .mockResolvedValueOnce(ok({ ok: true, token: 'new-token', profile: { employee_id: 30, name: 'New operator', role: 'operator' } }));
  const api = new OdooAccessApi(fetcher); await api.bootstrap();
  await expect(api.logout()).resolves.toBeUndefined();
  expect(fetcher.mock.calls[2][0]).toBe('/api/web/session/destroy');
  await api.bootstrap();
  expect(fetcher.mock.calls[3][0]).toBe('/api/session/prepare');
  await api.unlock(30, '1234');
  expect(JSON.parse(fetcher.mock.calls[5][1].body).params.csrf_token).toBe('new-synthetic-csrf');
});

it('accepts logout if the native session is already expired', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { data: { name: 'odoo.http.SessionExpiredException' } } })));
  await expect(new OdooAccessApi(fetcher).logout()).resolves.toBeUndefined();
});

it('still rejects malformed logout and missing results on other endpoints, and reports real network failures', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1 })))
    .mockRejectedValueOnce(new TypeError('offline'));
  const api = new OdooAccessApi(fetcher);
  await expect(api.logout()).rejects.toMatchObject({ kind: 'network' });
  await expect(api.profile('synthetic-token')).rejects.toMatchObject({ kind: 'network' });
  await expect(api.logout()).rejects.toMatchObject({ kind: 'network' });
});


it('reselects the database before authenticating after logout, rather than authenticating with an unprepared session', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('login')).mockResolvedValueOnce(ok(bootstrap))
    .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1 })))
    .mockResolvedValueOnce(new Response('fresh login')).mockResolvedValueOnce(ok({ uid: 11 }));
  const api = new OdooAccessApi(fetcher); await api.bootstrap(); await api.logout();
  await expect(api.login('synthetic-second-account', 'synthetic-password')).resolves.toBeUndefined();
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([
    '/api/session/prepare', '/api/cmp_pallets/access/bootstrap', '/api/web/session/destroy',
    '/api/session/prepare', '/api/web/session/authenticate',
  ]);
});

it('distinguishes actual credential rejection from an internal authentication failure without exposing details', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('login'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { data: { name: 'odoo.exceptions.AccessDenied' } } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { data: { name: 'builtins.AttributeError', message: 'internal detail' } } })));
  const api = new OdooAccessApi(fetcher);
  await expect(api.login('synthetic-account', 'wrong-synthetic-password')).rejects.toEqual(new ApiError('Usuario o contraseña incorrectos.', 'access'));
  await expect(api.login('synthetic-account', 'synthetic-password')).rejects.toEqual(new ApiError('Odoo no ha podido iniciar la sesión. Vuelve a intentarlo.', 'network'));
});
